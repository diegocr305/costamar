begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_coupon uuid := gen_random_uuid();
  v_campaign uuid;
  v_query text := 'hist-test-' || v_user;
  v_result jsonb;
begin
  select id into strict v_campaign from public.club_campaigns where slug='fundadores-50';
  insert into auth.users (id, email, raw_user_meta_data) values (v_user, 'history-' || v_user || '@example.invalid', '{"full_name":"Equipo de Prueba"}');
  insert into public.club_members(user_id,member_code,full_name,phone,birth_date)
    values(v_user,'TEST-' || v_user,'Socio de Prueba','+56912345678','2000-02-01');
  insert into public.club_coupons(id,code,campaign_id,user_id,status,period_key)
    values(v_coupon,'HIST-' || v_user,v_campaign,v_user,'redeemed','history-test');
  insert into public.club_coupon_redemptions(coupon_id,staff_user_id,member_user_id,consumption_ref,created_at)
    values(v_coupon,v_user,v_user,v_query || ' Mesa 42','2026-11-01T02:59:59Z');
  v_result := public.club_staff_redemption_history('2026-10-31',v_query,1,20);
  assert (v_result->>'total')::int=1, 'fecha incluye 23:59:59 del día chileno';
  assert v_result->'items'->0->>'staffName'='Equipo de Prueba', 'identifica funcionario';
  assert v_result->'items'->0->>'memberName'='Socio de Prueba', 'identifica socio';
  assert v_result->'items'->0->>'consumptionRef'=v_query || ' Mesa 42', 'conserva mesa';
  assert (public.club_staff_redemption_history('2026-11-01',v_query)->>'total')::int=0, 'no mezcla UTC con día chileno';
  assert jsonb_array_length(public.club_staff_redemption_history(null,v_query,2,1)->'items')=0, 'pagina sin repetir canjes';
  assert not has_function_privilege('authenticated','public.club_staff_redemption_history(date,text,integer,integer)','EXECUTE'), 'cliente sin RPC directa';
end;
$$;
select 'OK: fecha chilena, filtros, socio, funcionario, mesa, paginación y permisos' as result;
rollback;
