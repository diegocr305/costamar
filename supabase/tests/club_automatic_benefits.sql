-- Ejecutar contra el proyecto de prueba o con MCP. Todo se revierte.
begin;
do $$
declare
  v_user uuid := gen_random_uuid();
  v_minor uuid := gen_random_uuid();
  v_incomplete uuid := gen_random_uuid();
  v_first public.club_coupons;
  v_second public.club_coupons;
  v_other public.club_coupons;
begin
  insert into auth.users (id, email) values
    (v_user, 'birthday-test-' || v_user || '@example.invalid'),
    (v_minor, 'birthday-test-' || v_minor || '@example.invalid'),
    (v_incomplete, 'birthday-test-' || v_incomplete || '@example.invalid');
  insert into public.club_members (user_id, member_code, full_name, phone, birth_date) values
    (v_user, 'TEST-' || v_user, 'Prueba temporal', '+56912345678', '2000-02-29'),
    (v_minor, 'TEST-' || v_minor, 'Prueba menor', '+56912345678', '2015-02-01'),
    (v_incomplete, 'TEST-' || v_incomplete, 'Prueba incompleta', null, '2000-02-01');

  v_first := public.issue_birthday_coupon(v_user, '2026-02-28 20:00:00+00');
  assert v_first.id is not null, '29-feb recibe beneficio en febrero no bisiesto';
  assert v_first.period_key = 'y-2026', 'periodo anual chileno';
  assert v_first.expires_at = '2026-03-01 00:00:00 America/Santiago'::timestamptz, 'vence exactamente al terminar el mes chileno';
  v_second := public.issue_birthday_coupon(v_user, '2026-02-28 21:00:00+00');
  assert v_second.id = v_first.id, 'no duplica al consultar de nuevo';
  update public.club_coupons set status = 'redeemed', redeemed_at = now() where id = v_first.id;
  v_second := public.issue_birthday_coupon(v_user, '2026-02-28 22:00:00+00');
  assert v_second.id = v_first.id and v_second.status = 'redeemed', 'no reemite después de canjear';

  v_other := public.issue_birthday_coupon(v_user, '2026-03-01 03:00:00+00');
  assert v_other.id is null, 'no emite fuera del mes en Chile';
  v_other := public.issue_birthday_coupon(v_minor, '2026-02-10 12:00:00+00');
  assert v_other.id is null, 'rechaza menor de edad';
  v_other := public.issue_birthday_coupon(v_incomplete, '2026-02-10 12:00:00+00');
  assert v_other.id is null, 'rechaza perfil incompleto';

  update public.club_members set status = 'suspended' where user_id = v_user;
  v_other := public.issue_birthday_coupon(v_user, '2027-02-10 12:00:00+00');
  assert v_other.id is null, 'rechaza socio suspendido';
  update public.club_members set status = 'active' where user_id = v_user;
  v_other := public.issue_birthday_coupon(v_user, '2027-02-10 12:00:00+00');
  assert v_other.id is not null and v_other.id <> v_first.id and v_other.period_key = 'y-2027', 'nuevo año permite un cupón nuevo';

  begin
    update public.club_members set birth_date = '2000-03-01' where user_id = v_user;
    raise exception 'TEST_FAILED: cambio de cumpleaños permitido';
  exception when raise_exception then
    if sqlerrm <> 'BIRTH_DATE_LOCKED' then raise; end if;
  end;
  assert not has_function_privilege('anon', 'public.issue_birthday_coupon(uuid,timestamp with time zone)', 'EXECUTE'), 'anon no puede emitir';
  assert not has_function_privilege('authenticated', 'public.assign_club_benefits(uuid)', 'EXECUTE'), 'cliente no puede asignar';
end;
$$;
select 'OK: cumpleaños, febrero 29, zona horaria, idempotencia, canje, elegibilidad, año siguiente y permisos' as result;
rollback;
