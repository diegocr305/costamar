begin;
set local plpgsql.check_asserts=on;
do $$
declare
 v_hash text:=repeat('d',64);
 v_day date:=(now() at time zone 'America/Santiago')::date;
 v_noon timestamptz:=v_day::timestamp at time zone 'America/Santiago'+interval '12 hours';
 v_two timestamptz:=v_day::timestamp at time zone 'America/Santiago'+interval '14 hours';
 v_night timestamptz:=v_day::timestamp at time zone 'America/Santiago'+interval '3 hours';
 v_wed date:=date_trunc('week',now() at time zone 'America/Santiago')::date+9;
 v_input jsonb;v_created jsonb;
 v_web uuid;v_club uuid;v_admin uuid;v_cancelled uuid;
 v_x uuid;v_alert uuid;v_status text;v_detail text;v_have int;v_n int;v_payload jsonb;
 v_r1 uuid;v_r2 uuid;v_r3 uuid;v_r4 uuid;v_r5 uuid;v_r6 uuid;v_r7 uuid;
begin
 ---------------------------------------------------------------- 1) Trigger
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR web','+56922220001',2,now()+interval '3 days',90,15,15,'pending','web') returning id into v_web;
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR club','+56922220002',2,now()+interval '3 days',90,15,15,'pending','club') returning id into v_club;
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR admin','+56922220003',2,now()+interval '3 days',90,15,15,'pending','admin') returning id into v_admin;
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR cancelada','+56922220004',2,now()+interval '3 days',90,15,15,'cancelled','web') returning id into v_cancelled;
 assert exists(select 1 from public.reservation_alerts where reservation_id=v_web and kind='new' and status in ('pending','skipped')),'web genera aviso (pendiente u omitido según la hora)';
 assert exists(select 1 from public.reservation_alerts where reservation_id=v_club and kind='new'),'club genera aviso';
 assert not exists(select 1 from public.reservation_alerts where reservation_id=v_admin),'lo que ingresa el equipo no avisa';
 assert not exists(select 1 from public.reservation_alerts where reservation_id=v_cancelled),'una cancelada no avisa';

 -- Camino completo por el RPC público (formulario web).
 v_input:=jsonb_build_object('requestId',gen_random_uuid(),'customerName','ALR formulario','customerPhone','+56912345678','partySize',2,'reservedAt',v_wed::timestamp at time zone 'America/Santiago'+interval '13 hours','areaPreference','salon');
 v_created:=public.reservation_create(null,false,v_input,v_hash);
 assert (select count(*) from public.reservation_alerts where reservation_id=(v_created->>'id')::uuid and kind='new')=1,'el formulario real genera un aviso';
 assert public.reservation_create(null,false,v_input,v_hash)->>'id'=v_created->>'id','reintento devuelve la misma reserva';
 assert (select count(*) from public.reservation_alerts where reservation_id=(v_created->>'id')::uuid)=1,'el reintento no duplica el aviso';

 ---------------------------------------------------------------- 2) Horario de avisos (límites exactos)
 assert not public.reservation_alert_in_hours(v_day::timestamp at time zone 'America/Santiago'+interval '7 hours 59 minutes'),'07:59 fuera';
 assert public.reservation_alert_in_hours(v_day::timestamp at time zone 'America/Santiago'+interval '8 hours'),'08:00 dentro';
 assert public.reservation_alert_in_hours(v_day::timestamp at time zone 'America/Santiago'+interval '22 hours 59 minutes'),'22:59 dentro';
 assert not public.reservation_alert_in_hours(v_day::timestamp at time zone 'America/Santiago'+interval '23 hours'),'23:00 fuera';

 ---------------------------------------------------------------- 3) enqueue: dentro/fuera de horario e idempotencia
 v_alert:=public.reservation_alert_enqueue(v_admin,'new',v_noon);
 assert v_alert is not null and (select status from public.reservation_alerts where id=v_alert)='pending','12:00 -> pendiente de envío';
 assert public.reservation_alert_enqueue(v_admin,'new',v_noon) is null,'segunda vez no duplica';
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR noche','+56922220005',2,now()+interval '3 days',90,15,15,'pending','admin') returning id into v_x;
 v_alert:=public.reservation_alert_enqueue(v_x,'new',v_night);
 select status,detail into v_status,v_detail from public.reservation_alerts where id=v_alert;
 assert v_status='skipped' and v_detail like 'fuera de horario%','03:00 -> omitido y va al resumen: '||coalesce(v_detail,'');

 ---------------------------------------------------------------- 4) Tope de 20 avisos por hora
 select count(*) into v_have from public.reservation_alerts where kind='new' and status in ('pending','sent') and created_at>v_noon-interval '1 hour';
 assert v_have<=19,'preparación del tope';
 for v_n in 1..(19-v_have) loop
  insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
   values(gen_random_uuid(),v_hash,'ALR tope '||v_n,'+56922220006',2,now()+interval '4 days',90,15,15,'pending','admin') returning id into v_x;
  insert into public.reservation_alerts(reservation_id,kind,status,created_at) values(v_x,'new','sent',v_noon-interval '10 minutes');
 end loop;
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR aviso 20','+56922220007',2,now()+interval '4 days',90,15,15,'pending','admin') returning id into v_x;
 v_alert:=public.reservation_alert_enqueue(v_x,'new',v_noon);
 assert (select status from public.reservation_alerts where id=v_alert)='pending','el aviso 20 todavía se envía';
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source)
  values(gen_random_uuid(),v_hash,'ALR aviso 21','+56922220008',2,now()+interval '4 days',90,15,15,'pending','admin') returning id into v_x;
 v_alert:=public.reservation_alert_enqueue(v_x,'new',v_noon);
 select status,detail into v_status,v_detail from public.reservation_alerts where id=v_alert;
 assert v_status='skipped' and v_detail like 'tope de 20%','el aviso 21 se omite: '||coalesce(v_detail,'');

 ---------------------------------------------------------------- 5) Recordatorio a la hora
 -- Ahora simulado = hoy 14:00. R1/R7 deben recordarse; el resto no.
 insert into public.reservations(request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,source,created_at) values
  (gen_random_uuid(),v_hash,'ALR r1 elegible','+56933330001',2,v_day::timestamp at time zone 'America/Santiago'+interval '18 hours',90,15,15,'pending','web',v_two-interval '2 hours'),
  (gen_random_uuid(),v_hash,'ALR r2 reciente','+56933330002',2,v_day::timestamp at time zone 'America/Santiago'+interval '18 hours',90,15,15,'pending','web',v_two-interval '30 minutes'),
  (gen_random_uuid(),v_hash,'ALR r3 manana','+56933330003',2,(v_day+1)::timestamp at time zone 'America/Santiago'+interval '18 hours',90,15,15,'pending','web',v_two-interval '2 hours'),
  (gen_random_uuid(),v_hash,'ALR r4 ya paso','+56933330004',2,v_day::timestamp at time zone 'America/Santiago'+interval '13 hours',90,15,15,'pending','web',v_two-interval '2 hours'),
  (gen_random_uuid(),v_hash,'ALR r5 equipo','+56933330005',2,v_day::timestamp at time zone 'America/Santiago'+interval '18 hours',90,15,15,'pending','admin',v_two-interval '2 hours'),
  (gen_random_uuid(),v_hash,'ALR r6 cancelada','+56933330006',2,v_day::timestamp at time zone 'America/Santiago'+interval '18 hours',90,15,15,'cancelled','web',v_two-interval '2 hours'),
  (gen_random_uuid(),v_hash,'ALR r7 elegible','+56933330007',2,v_day::timestamp at time zone 'America/Santiago'+interval '19 hours',90,15,15,'pending','web',v_night-interval '2 hours');
 select id into v_r1 from public.reservations where customer_name='ALR r1 elegible';
 select id into v_r2 from public.reservations where customer_name='ALR r2 reciente';
 select id into v_r3 from public.reservations where customer_name='ALR r3 manana';
 select id into v_r4 from public.reservations where customer_name='ALR r4 ya paso';
 select id into v_r5 from public.reservations where customer_name='ALR r5 equipo';
 select id into v_r6 from public.reservations where customer_name='ALR r6 cancelada';
 select id into v_r7 from public.reservations where customer_name='ALR r7 elegible';
 assert public.reservation_alert_reminders(v_night)=0,'03:00: fuera de horario, no hay recordatorios';
 assert not exists(select 1 from public.reservation_alerts where kind='reminder' and reservation_id in (v_r1,v_r7)),'nada se registró fuera de horario';
 assert public.reservation_alert_reminders(v_two)=2,'14:00: se recuerdan exactamente 2 (r1 y r7)';
 assert (select count(*) from public.reservation_alerts where kind='reminder' and reservation_id in (v_r1,v_r7))=2,'quedan registrados';
 assert not exists(select 1 from public.reservation_alerts where kind='reminder' and reservation_id in (v_r2,v_r3,v_r4,v_r5,v_r6)),'reciente, de otro día, ya pasada, del equipo y cancelada no se recuerdan';
 assert public.reservation_alert_reminders(v_two)=0,'un solo recordatorio por reserva';

 ---------------------------------------------------------------- 6) Datos del correo
 select id into v_alert from public.reservation_alerts where kind='reminder' and reservation_id=v_r1;
 v_payload:=public.reservation_alert_payload(v_alert);
 assert v_payload->>'kind'='reminder' and v_payload->>'alertStatus'='pending','payload: tipo y estado';
 assert v_payload->'reservation'->>'customerName'='ALR r1 elegible' and v_payload->'reservation'->>'customerPhone'='+56933330001','payload: datos del cliente';
 assert (v_payload->>'isToday')::boolean,'payload: es de hoy';
 assert (v_payload->>'pendingCount')::int>=1 and (v_payload->>'minutesUntil')::int>=0,'payload: contadores';
 assert public.reservation_alert_payload(gen_random_uuid()) is null,'alerta inexistente -> null';

 ---------------------------------------------------------------- 7) Marcado
 perform public.reservation_alert_mark(v_alert,'sent','resend:accepted');
 assert (select status from public.reservation_alerts where id=v_alert)='sent' and (select sent_at from public.reservation_alerts where id=v_alert) is not null,'queda enviada';
 perform public.reservation_alert_mark(v_alert,'failed','otro intento');
 assert (select status from public.reservation_alerts where id=v_alert)='sent','no se puede pisar un aviso ya cerrado';
 begin perform public.reservation_alert_mark(v_alert,'cualquiera');raise exception 'TEST_FAILED: estado inválido';exception when raise_exception then if sqlerrm<>'ALERT_STATUS_INVALID' then raise;end if;end;

 ---------------------------------------------------------------- 8) Permisos
 assert has_function_privilege('service_role','public.reservation_alert_payload(uuid)','execute'),'service_role ejecuta payload';
 assert not has_function_privilege('authenticated','public.reservation_alert_enqueue(uuid,text,timestamptz)','execute'),'authenticated no encola';
 assert not has_function_privilege('anon','public.reservation_alert_payload(uuid)','execute'),'anon no lee payload';
 assert not has_function_privilege('authenticated','public.reservation_alert_mark(uuid,text,text)','execute'),'authenticated no marca';
 assert not has_function_privilege('authenticated','public.reservation_alert_reminders(timestamptz)','execute'),'authenticated no dispara recordatorios';
end $$;
select 'OK: trigger, horario 08-23, idempotencia, tope por hora, recordatorio a la hora, payload y permisos' as result;
rollback;
