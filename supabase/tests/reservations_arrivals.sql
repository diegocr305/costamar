begin;
set local plpgsql.check_asserts=on;
do $$
declare v_staff uuid:=gen_random_uuid();v_a uuid:=gen_random_uuid();v_b uuid:=gen_random_uuid();v_c uuid:=gen_random_uuid();v_d uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email) values(v_staff,'arrival-staff-'||v_staff||'@example.invalid');
 insert into public.user_roles(user_id,role_id) select v_staff,id from public.roles where name='cashier';
 insert into public.reservations(id,request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,table_numbers,confirmed_capacity,source) values
 (v_a,v_a,repeat('a',64),'Llega tarde','+56912345678',2,now()-interval '90 minutes',90,15,15,'confirmed',array[15],3,'admin'),
 (v_b,v_b,repeat('b',64),'Siguiente turno','+56912345679',2,now()+interval '30 minutes',90,15,15,'confirmed',array[15],3,'admin');
 begin perform public.reservation_update(v_staff,v_a,'{"status":"seated"}');raise exception 'TEST_FAILED: llegada tardía invade siguiente turno';exception when raise_exception then if sqlerrm not in ('RESERVATION_OVERLAP','RESERVATION_ARRIVAL_TIME') then raise;end if;end;
 -- Una visita que excedió la previsión permanece ocupando su mesa.
 update public.reservations set status='seated',seated_at=now()-interval '2 hours',reserved_at=now()-interval '2 hours' where id=v_a;
 begin perform public.reservation_update(v_staff,v_b,'{"status":"seated"}');raise exception 'TEST_FAILED: llegada temprana';exception when raise_exception then if sqlerrm<>'RESERVATION_ARRIVAL_TIME' then raise;end if;end;
 insert into public.reservations(id,request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,table_numbers,confirmed_capacity,source) values
 (v_c,v_c,repeat('c',64),'Llega ahora','+56912345670',2,now()-interval '1 minute',90,15,15,'confirmed',array[15],3,'admin');
 update public.reservations set status='cancelled' where id=v_b;
 begin perform public.reservation_update(v_staff,v_c,'{"status":"seated"}');raise exception 'TEST_FAILED: mesa aún ocupada';exception when raise_exception then if sqlerrm<>'RESERVATION_STILL_SEATED' then raise;end if;end;
 perform public.reservation_update(v_staff,v_a,'{"status":"completed"}');
 assert (select released_at is not null from public.reservations where id=v_a),'libera al finalizar';
 perform public.reservation_update(v_staff,v_c,'{"status":"seated"}');
 assert (select seated_at is not null from public.reservations where id=v_c),'llegada real';
 -- Un grupo previamente aprobado puede ser recibido y finalizado por caja.
 insert into public.reservations(id,request_key,access_hash,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,status,table_numbers,confirmed_capacity,source) values
 (v_d,v_d,repeat('d',64),'Grupo aprobado','+56912345671',6,now()-interval '1 minute',120,15,15,'confirmed',array[9,11,13],10,'admin');
 perform public.reservation_update(v_staff,v_d,'{"status":"seated"}');
 perform public.reservation_update(v_staff,v_d,'{"status":"completed"}');
 assert (select seated_at is not null and released_at is not null from public.reservations where id=v_d),'caja atiende grupo aprobado';
end;$$;
select 'OK: llegada tardía, margen temprano, mesa aún ocupada y finalización real' as result;
rollback;
