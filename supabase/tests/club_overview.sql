begin;
set local plpgsql.check_asserts=on;
do $$
declare
 v_owner uuid:=gen_random_uuid();v_staff uuid:=gen_random_uuid();v_a uuid:=gen_random_uuid();v_b uuid:=gen_random_uuid();v_c uuid:=gen_random_uuid();v_d uuid:=gen_random_uuid();
 v_day date:=(now() at time zone 'America/Santiago')::date;v_start timestamptz;v_before jsonb;v_mid jsonb;v_after jsonb;v_campaign uuid;v_r1 uuid:=gen_random_uuid();v_r2 uuid:=gen_random_uuid();v_counts bigint;
begin
 v_start:=v_day::timestamp at time zone 'America/Santiago';
 insert into auth.users(id,email,raw_app_meta_data) values
 (v_owner,'overview-owner-'||v_owner||'@example.invalid','{"role":"superadmin"}'),
 (v_staff,'overview-staff-'||v_staff||'@example.invalid','{"role":"cashier"}'),
 (v_a,'overview-a-'||v_a||'@example.invalid','{}'),(v_b,'overview-b-'||v_b||'@example.invalid','{}'),
 (v_c,'overview-c-'||v_c||'@example.invalid','{}'),(v_d,'overview-d-'||v_d||'@example.invalid','{}');
 insert into public.user_roles(user_id,role_id) select v_owner,id from public.roles where name='superadmin';
 insert into public.user_roles(user_id,role_id) select v_staff,id from public.roles where name='cashier';
 v_before:=public.club_admin_overview(v_owner);
 insert into public.club_members(user_id,member_code,full_name,phone,birth_date,enrolled_at,status) values
 (v_a,'TEST-'||v_a,'Overview hoy','+56912345678',make_date(1990,extract(month from v_day)::int,1),v_start,'active'),
 (v_b,'TEST-'||v_b,'Overview semana','+56912345678',make_date(1990,extract(month from v_day)::int,1),(v_day-6)::timestamp at time zone 'America/Santiago','active'),
 (v_c,'TEST-'||v_c,'Overview mes','+56912345678',make_date(1990,(extract(month from v_day)::int%12)+1,1),(v_day-29)::timestamp at time zone 'America/Santiago','active'),
 (v_d,'TEST-'||v_d,'Overview suspendido','+56912345678',make_date(1990,extract(month from v_day)::int,1),(v_day-30)::timestamp at time zone 'America/Santiago','suspended');
 insert into public.club_member_preferences(user_id,survey_status) values(v_a,'viewed'),(v_b,'responded'),(v_d,'skipped');
 v_campaign:=(public.club_admin_save_campaign(v_owner,null,jsonb_build_object('slug','overview-'||v_owner,'name','Overview temporal','benefit','Temporal','maxCoupons',10,'endsAt',now()+interval '1 day'))->>'id')::uuid;
 -- El alta de socios también asigna sus regalos generales mediante triggers.
 v_mid:=public.club_admin_overview(v_owner);
 insert into public.club_coupons(id,code,campaign_id,user_id,status,period_key,expires_at) values
 (gen_random_uuid(),'OV-A-'||v_a,v_campaign,v_a,'issued','a',now()+interval '1 day'),
 (gen_random_uuid(),'OV-B-'||v_a,v_campaign,v_a,'issued','b',now()),
 (gen_random_uuid(),'OV-D-'||v_d,v_campaign,v_d,'issued','d',null),
 (v_r1,'OV-R1-'||v_a,v_campaign,v_a,'redeemed','r1',null),(v_r2,'OV-R2-'||v_a,v_campaign,v_a,'redeemed','r2',null);
 insert into public.club_coupon_redemptions(coupon_id,staff_user_id,member_user_id,consumption_ref,created_at) values
 (v_r1,v_staff,v_a,'Mesa temporal',v_start),(v_r2,v_staff,v_a,'Mesa temporal',v_start-interval '1 second');
 select count(*) into v_counts from public.club_coupons;
 v_after:=public.club_admin_overview(v_owner);
 assert (v_after#>>'{members,total}')::int-(v_before#>>'{members,total}')::int=4,'total';
 assert (v_after#>>'{members,active}')::int-(v_before#>>'{members,active}')::int=3,'activos';
 assert (v_after#>>'{members,newToday}')::int-(v_before#>>'{members,newToday}')::int=1,'inicio hoy';
 assert (v_after#>>'{members,new7Days}')::int-(v_before#>>'{members,new7Days}')::int=2,'siete días calendario';
 assert (v_after#>>'{members,new30Days}')::int-(v_before#>>'{members,new30Days}')::int=3,'treinta días calendario';
 assert (v_after#>>'{members,birthdaysThisMonth}')::int-(v_before#>>'{members,birthdaysThisMonth}')::int=2,'cumpleaños activos';
 assert (v_after#>>'{surveys,total}')::int-(v_before#>>'{surveys,total}')::int=3,'encuestas socios activos';
 assert (v_after#>>'{surveys,notShown}')::int-(v_before#>>'{surveys,notShown}')::int=1,'sin fila de preferencias';
 assert (v_after#>>'{surveys,viewed}')::int-(v_before#>>'{surveys,viewed}')::int=1,'vista';
 assert (v_after#>>'{surveys,responded}')::int-(v_before#>>'{surveys,responded}')::int=1,'respondida';
 assert (v_after#>>'{surveys,skipped}')::int=(v_before#>>'{surveys,skipped}')::int,'suspendido excluido';
 assert (v_after#>>'{coupons,available}')::int-(v_mid#>>'{coupons,available}')::int=1,'excluye vencidos y suspendidos';
 assert (v_after#>>'{coupons,expired}')::int-(v_before#>>'{coupons,expired}')::int=1,'vence exactamente ahora';
 assert (v_after#>>'{redemptions,today}')::int-(v_before#>>'{redemptions,today}')::int=1,'medianoche Chile';
 assert (v_after#>>'{redemptions,last7Days}')::int-(v_before#>>'{redemptions,last7Days}')::int=2,'canjes semanales';
 assert (select count(*) from public.club_coupons)=v_counts,'resumen solo lectura';
 begin
  perform public.club_admin_overview(v_staff);raise exception 'TEST_FAILED: cashier';
 exception when raise_exception then if sqlerrm<>'OVERVIEW_REQUIRED' then raise;end if;end;
 assert not has_function_privilege('authenticated','public.club_admin_overview(uuid)','EXECUTE'),'sin RPC directa';
end;
$$;
select 'OK: permisos, lectura, días de Chile, altas, encuestas, cumpleaños, vencimientos y canjes' as result;
rollback;
