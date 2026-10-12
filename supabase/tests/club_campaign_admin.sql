-- Casos funcionales completos; las cuentas, campañas, productos y canjes se revierten.
begin;
set local plpgsql.check_asserts = on;
do $$
declare
  v_actor uuid := gen_random_uuid(); v_cashier uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid(); v_other uuid := gen_random_uuid();
  v_category uuid := gen_random_uuid(); v_drink uuid := gen_random_uuid(); v_dessert uuid := gen_random_uuid();
  v_id uuid; v_birthday uuid; v_result jsonb; v_first public.club_coupons; v_again public.club_coupons;
  v_red public.club_coupon_redemptions; v_end timestamptz := now()+interval '10 days'; v_old_expiry timestamptz;
begin
  insert into auth.users(id,email,raw_app_meta_data) values
    (v_actor,'campaign-actor-'||v_actor||'@example.invalid','{"role":"manager"}'),
    (v_cashier,'campaign-staff-'||v_cashier||'@example.invalid','{"role":"cashier"}'),
    (v_member,'campaign-member-'||v_member||'@example.invalid','{}'),
    (v_other,'campaign-other-'||v_other||'@example.invalid','{}');
  insert into public.club_members(user_id,member_code,full_name,phone,birth_date) values
    (v_member,'TEST-'||v_member,'Socio promoción','+56912345678','1990-02-01'),
    (v_other,'TEST-'||v_other,'Socio sin cupo','+56912345679','1990-02-01');
  insert into public.categories(id,name) values(v_category,'Categoría temporal');
  insert into public.products(id,category_id,name,base_price,is_available) values
    (v_drink,v_category,'Bebestible temporal',1000,true),(v_dessert,v_category,'Postre temporal',1000,false);
  begin
    perform public.club_admin_save_campaign(v_cashier,null,jsonb_build_object('slug','unauthorized-'||v_actor,'name','No autorizado','benefit','Regalo'));
    raise exception 'TEST_FAILED: cajero modificó campañas';
  exception when raise_exception then if sqlerrm <> 'CAMPAIGN_ADMIN_REQUIRED' then raise; end if; end;
  v_result := public.club_admin_save_campaign(v_actor,null,jsonb_build_object(
    'slug','test-campaign-'||v_actor,'name','Promoción temporal','benefit','Un regalo personal','status','draft',
    'maxCoupons',1,'startsAt',now()-interval '1 day','endsAt',v_end,'validityDays',30,
    'products',jsonb_build_array(jsonb_build_object('productId',v_drink,'role','drink'),jsonb_build_object('productId',v_dessert,'role','dessert'))));
  v_id := (v_result->>'id')::uuid;
  assert v_id is not null and v_result->>'type'='promotion', 'crea una promoción con catálogo';
  assert jsonb_array_length(v_result->'products')=2, 'guarda productos y campaña en la misma operación';
  assert (select count(*) from public.club_campaign_events where campaign_id=v_id)=1, 'audita creación';
  assert (public.issue_campaign_coupon(v_id,v_member)).id is null, 'borrador no emite';
  perform public.club_admin_save_campaign(v_actor,v_id,'{"status":"active"}');
  v_first := public.issue_campaign_coupon(v_id,v_member);
  assert v_first.id is not null and v_first.expires_at=v_end, 'emite y limita vigencia al término de campaña';
  v_again := public.issue_campaign_coupon(v_id,v_member);
  assert v_again.id=v_first.id, 'no duplica emisión';
  assert (public.issue_campaign_coupon(v_id,v_other)).id is null, 'respeta el cupo máximo';
  begin
    perform public.club_admin_save_campaign(v_actor,v_id,'{"maxCoupons":0}');
    raise exception 'TEST_FAILED: cupos menores a emitidos';
  exception when raise_exception then if sqlerrm <> 'CAMPAIGN_LIMIT_TOO_LOW' then raise; end if; end;
  begin
    perform public.club_admin_save_campaign(v_actor,v_id,jsonb_build_object('name','Cambio parcial','products',jsonb_build_array(jsonb_build_object('productId',gen_random_uuid(),'role','gift'))));
    raise exception 'TEST_FAILED: catálogo inexistente';
  exception when raise_exception then if sqlerrm <> 'CAMPAIGN_PRODUCTS_INVALID' then raise; end if; end;
  assert (select name from public.club_campaigns where id=v_id)='Promoción temporal', 'error de productos revierte la edición completa';
  begin
    perform public.redeem_coupon(v_first.code,v_cashier,'[]','Mesa prueba');
    raise exception 'TEST_FAILED: canje sin selección de productos';
  exception when raise_exception then if sqlerrm <> 'CAMPAIGN_PRODUCTS_INVALID' then raise; end if; end;
  begin
    perform public.redeem_coupon(v_first.code,v_cashier,jsonb_build_array(jsonb_build_object('productId',v_drink,'role','drink'),jsonb_build_object('productId',v_dessert,'role','dessert')),'Mesa prueba');
    raise exception 'TEST_FAILED: producto sin disponibilidad';
  exception when raise_exception then if sqlerrm <> 'CAMPAIGN_PRODUCTS_INVALID' then raise; end if; end;
  update public.products set is_available=true where id=v_dessert;
  v_red := public.redeem_coupon(v_first.code,v_cashier,jsonb_build_array(jsonb_build_object('productId',v_drink,'role','drink'),jsonb_build_object('productId',v_dessert,'role','dessert')),' Mesa prueba ');
  assert v_red.consumption_ref='Mesa prueba' and jsonb_array_length(v_red.products)=2, 'registra consumo y productos';
  assert v_red.products->0 ? 'name', 'guarda nombre del producto entregado';
  begin
    perform public.redeem_coupon(v_first.code,v_cashier,'[]','Mesa prueba');
    raise exception 'TEST_FAILED: doble canje';
  exception when raise_exception then if sqlerrm <> 'ALREADY_REDEEMED' then raise; end if; end;
  v_result := public.club_admin_campaign_coupons(v_id,'redeemed','Socio promoción',1,20);
  assert (v_result->>'total')::int=1, 'filtra cupones por estado y socio';
  assert (public.club_staff_redemption_history_filtered(null,null,1,20,v_id)->>'total')::int=1, 'historial filtrado por campaña';
  perform public.club_admin_save_campaign(v_actor,v_id,'{"status":"paused"}');
  assert (public.issue_campaign_coupon(v_id,v_other)).id is null, 'pausa detiene emisión';
  select expires_at into v_old_expiry from public.club_coupons where id=v_first.id;
  perform public.club_admin_save_campaign(v_actor,v_id,'{"validityDays":1}');
  assert (select expires_at from public.club_coupons where id=v_first.id)=v_old_expiry, 'no cambia vigencia de cupones emitidos';
  select id into strict v_birthday from public.club_campaigns where type='birthday';
  begin
    perform public.club_admin_save_campaign(v_actor,v_birthday,'{"maxCoupons":50}');
    raise exception 'TEST_FAILED: cumpleaños limitado';
  exception when raise_exception then if sqlerrm <> 'BIRTHDAY_UNLIMITED' then raise; end if; end;
  assert not has_function_privilege('authenticated','public.club_admin_save_campaign(uuid,uuid,jsonb)','EXECUTE'), 'cliente no puede editar por RPC';
  assert not has_function_privilege('anon','public.club_admin_campaigns()','EXECUTE'), 'anon no lee reportes privados';
end;
$$;
select 'OK: permisos, creación, catálogo atómico, emisión, cupos, vencimiento, pausa, canje, filtros, auditoría y cumpleaños ilimitado' as result;
rollback;
