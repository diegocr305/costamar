begin;
set local plpgsql.check_asserts=on;
do $$
declare
 v_staff uuid:=gen_random_uuid();
 v_today date:=(now() at time zone 'America/Santiago')::date;
 v_hash text:=repeat('b',64);
 v_names text[];
 v_digest jsonb;
 v_today_names text[];
 v_pending_names text[];
begin
 insert into auth.users(id,email,raw_app_meta_data) values(v_staff,'prio-staff-'||v_staff||'@example.invalid','{"role":"cashier"}');
 insert into public.user_roles(user_id,role_id) select v_staff,id from public.roles where name='cashier';

 -- Reservas en distintos estados y fechas (inserción directa: son datos históricos).
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,table_numbers,confirmed_capacity,source) values
  (gen_random_uuid(),v_hash,'PRIO-A cerrada vieja','+56911110001',2,now()-interval '30 days',90,15,15,'completed','{1}',2,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-B cerrada reciente','+56911110002',2,now()-interval '3 days',90,15,15,'cancelled','{}',null,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-C abierta pasada','+56911110003',2,now()-interval '5 days',90,15,15,'confirmed','{2}',2,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-D confirmada lejana','+56911110004',2,now()+interval '10 days',90,15,15,'confirmed','{3}',3,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-E confirmada proxima','+56911110005',2,now()+interval '2 days',90,15,15,'confirmed','{4}',3,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-F pendiente lejana','+56911110006',2,now()+interval '9 days',90,15,15,'pending','{}',null,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-G pendiente proxima','+56911110007',2,now()+interval '1 day',90,15,15,'pending','{}',null,'admin');

 -- 1) Sin fecha: primero lo que hay que hacer, lo más antiguo al final.
 select array_agg(i->>'customerName' order by o) into v_names
  from jsonb_array_elements(public.reservation_list(v_staff,true,null,'','PRIO-',1)->'items') with ordinality as t(i,o);
 assert v_names=array['PRIO-G pendiente proxima','PRIO-F pendiente lejana','PRIO-E confirmada proxima','PRIO-D confirmada lejana','PRIO-C abierta pasada','PRIO-B cerrada reciente','PRIO-A cerrada vieja'],
  'orden por prioridad sin fecha: '||array_to_string(v_names,' | ');

 -- 1b) Solo pendientes: la más próxima primero.
 select array_agg(i->>'customerName' order by o) into v_names
  from jsonb_array_elements(public.reservation_list(v_staff,true,null,'pending','PRIO-',1)->'items') with ordinality as t(i,o);
 assert v_names=array['PRIO-G pendiente proxima','PRIO-F pendiente lejana'],'pendientes: la más próxima primero';

 -- 2) Con fecha elegida: orden por hora, sin importar el estado.
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,table_numbers,confirmed_capacity,source) values
  (gen_random_uuid(),v_hash,'PRIO-H hoy tarde','+56911110008',2,v_today::timestamp at time zone 'America/Santiago'+interval '20 hours',90,15,15,'pending','{}',null,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-I hoy temprano','+56911110009',2,v_today::timestamp at time zone 'America/Santiago'+interval '13 hours',90,15,15,'pending','{}',null,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-J hoy cerrada','+56911110010',2,v_today::timestamp at time zone 'America/Santiago'+interval '11 hours',90,15,15,'completed','{5}',2,'admin'),
  (gen_random_uuid(),v_hash,'PRIO-K hoy cancelada','+56911110011',2,v_today::timestamp at time zone 'America/Santiago'+interval '15 hours',90,15,15,'cancelled','{}',null,'admin');
 select array_agg(i->>'customerName' order by o) into v_names
  from jsonb_array_elements(public.reservation_list(v_staff,true,v_today,'','PRIO-',1)->'items') with ordinality as t(i,o);
 assert v_names=array['PRIO-J hoy cerrada','PRIO-I hoy temprano','PRIO-K hoy cancelada','PRIO-H hoy tarde'],
  'con fecha: orden por hora: '||array_to_string(v_names,' | ');

 -- 3) Resumen diario.
 v_digest:=public.reservation_daily_digest();
 select array_agg(i->>'customerName' order by o) into v_today_names
  from jsonb_array_elements(v_digest->'today') with ordinality as t(i,o) where i->>'customerName' like 'PRIO-%';
 assert v_today_names=array['PRIO-J hoy cerrada','PRIO-I hoy temprano','PRIO-H hoy tarde'],
  'resumen: hoy por hora y sin canceladas: '||coalesce(array_to_string(v_today_names,' | '),'(vacío)');
 select array_agg(i->>'customerName' order by o) into v_pending_names
  from jsonb_array_elements(v_digest->'pending') with ordinality as t(i,o) where i->>'customerName' like 'PRIO-%';
 assert v_pending_names @> array['PRIO-G pendiente proxima','PRIO-F pendiente lejana'] and not (v_pending_names && array['PRIO-D confirmada lejana','PRIO-C abierta pasada']),
  'resumen: solo pendientes por confirmar';
 assert (v_digest->>'stale')::int>=1,'resumen cuenta reservas abiertas con fecha pasada (PRIO-C)';
 assert (v_digest->>'date')::date=v_today,'resumen: fecha de hoy en Chile';
 assert (public.reservation_daily_digest(v_today+1)->>'date')::date=v_today+1,'resumen acepta otra fecha';

 -- 4) Permisos: solo service_role.
 assert has_function_privilege('service_role','public.reservation_daily_digest(date)','execute'),'service_role ejecuta el resumen';
 assert not has_function_privilege('authenticated','public.reservation_daily_digest(date)','execute'),'authenticated no ejecuta el resumen';
 assert not has_function_privilege('anon','public.reservation_daily_digest(date)','execute'),'anon no ejecuta el resumen';
 assert not has_function_privilege('authenticated','public.reservation_dispatch_digest()','execute'),'authenticated no despacha';

 -- 5) Sin settings de Edge Function el despacho no falla ni envía nada.
 perform public.reservation_dispatch_digest();
end $$;
select 'OK: orden por prioridad, orden por hora, resumen diario y permisos' as result;
rollback;
