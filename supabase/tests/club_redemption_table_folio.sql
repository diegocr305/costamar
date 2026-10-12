begin;
set local plpgsql.check_asserts=on;
do $$
declare
  v_actor uuid := gen_random_uuid(); v_staff uuid := gen_random_uuid(); v_user uuid := gen_random_uuid();
  v_campaign uuid; v_coupon1 uuid := gen_random_uuid(); v_coupon2 uuid := gen_random_uuid(); v_result jsonb; v_second jsonb;
begin
  insert into auth.users(id,email,raw_app_meta_data) values
    (v_actor,'table-actor-'||v_actor||'@example.invalid','{"role":"manager"}'),
    (v_staff,'table-staff-'||v_staff||'@example.invalid','{"role":"cashier"}'),
    (v_user,'table-user-'||v_user||'@example.invalid','{}');
  insert into public.club_members(user_id,member_code,full_name,phone,birth_date) values(v_user,'TEST-'||v_user,'Socio temporal mesa','+56912345678','1990-02-01');
  v_campaign := (public.club_admin_save_campaign(v_actor,null,jsonb_build_object('slug','table-test-'||v_actor,'name','Mesa temporal','benefit','Regalo temporal','maxCoupons',2,'endsAt',now()+interval '1 day'))->>'id')::uuid;
  insert into public.club_coupons(id,code,campaign_id,user_id,period_key) values
    (v_coupon1,'TABLE-'||v_coupon1,v_campaign,v_user,'table-1'),(v_coupon2,'TABLE-'||v_coupon2,v_campaign,v_user,'table-2');
  begin
    perform public.redeem_coupon_at_table('TABLE-'||v_coupon1,v_staff,' ');
    raise exception 'TEST_FAILED: mesa vacía';
  exception when raise_exception then if sqlerrm <> 'TABLE_REQUIRED' then raise; end if; end;
  assert (select status from public.club_coupons where id=v_coupon1)='issued', 'mesa inválida no canjea';
  v_result := public.redeem_coupon_at_table('TABLE-'||v_coupon1,v_staff,'5');
  assert v_result->>'tableLabel'='Mesa 5', 'normaliza número de mesa';
  assert v_result->>'orderRef' is null and v_result->>'note' is null, 'solo mesa basta';
  assert v_result->>'folio' ~ '^CAN-[0-9]{6,}$', 'folio automático';
  v_second := public.redeem_coupon_at_table('TABLE-'||v_coupon2,v_staff,'Mesa 50','[]',' Boleta 123 ',' Observación temporal ');
  assert v_second->>'folio' <> v_result->>'folio', 'folios distintos';
  assert v_second->>'orderRef'='Boleta 123' and v_second->>'note'='Observación temporal', 'campos separados';
  assert (public.club_recent_redemptions('Mesa 5')->>'total')::int=1, 'mesa 5 no incluye mesa 50';
  assert (public.club_staff_redemption_history(null,v_result->>'folio')->>'total')::int=1, 'encuentra por folio';
  assert (public.club_staff_redemption_history_filtered(null,null,1,20,v_campaign)->>'total')::int=2, 'historial por campaña conserva ambos';
  begin
    perform public.redeem_coupon_at_table('TABLE-'||v_coupon1,v_staff,'Mesa 5');
    raise exception 'TEST_FAILED: doble canje';
  exception when raise_exception then if sqlerrm <> 'ALREADY_REDEEMED' then raise; end if; end;
  assert not has_function_privilege('authenticated','public.redeem_coupon_at_table(text,uuid,text,jsonb,text,text)','EXECUTE'), 'solo backend puede confirmar';
  assert not has_function_privilege('anon','public.club_recent_redemptions(text)','EXECUTE'), 'historial protegido';
end;
$$;
select 'OK: mesa obligatoria, opcionales, folio único, búsqueda exacta, historial y doble canje' as result;
rollback;
