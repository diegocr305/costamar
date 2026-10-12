-- Ejecutar después de la migración; todo se revierte al terminar.
begin;
do $$ declare o uuid := gen_random_uuid(); x uuid; n integer; fp text; begin
 if has_table_privilege('anon','public.radar_opportunities','select') or has_table_privilege('authenticated','public.radar_profiles','update') then raise exception 'Public access'; end if;
 if has_function_privilege('authenticated','public.radar_claim(uuid,integer)','execute') then raise exception 'Public RPC'; end if;
 if not public.radar_claim(o,900) then raise exception 'Initial lease'; end if;
 if public.radar_claim(gen_random_uuid(),900) then raise exception 'Duplicate worker'; end if;
 if not public.radar_consume_request(o,1) then raise exception 'Quota claim'; end if;
 if public.radar_consume_request(o,1) then raise exception 'Quota exceeded'; end if;
 select id into x from public.radar_profiles limit 1;
 x:=public.radar_ingest(o,jsonb_build_object('source','compra_agil','code','999-1-COT26','name','Alimentación test','official_status','publicada','closes_raw','2026-12-01 09:00','items','[]'::jsonb,'documents','[]'::jsonb,'profile_ids',jsonb_build_array(x)),jsonb_build_object('test',1),'one');
 perform public.radar_ingest(o,jsonb_build_object('source','compra_agil','code','999-1-COT26','name','Alimentación test','official_status','publicada','closes_raw','2026-12-01 09:00','items','[]'::jsonb,'documents','[]'::jsonb,'profile_ids',jsonb_build_array((select id from public.radar_profiles limit 1))),jsonb_build_object('test',1),'one');
 select count(*) into n from public.radar_alerts where opportunity_id=x;
 if n<>1 then raise exception 'Duplicate alerts'; end if;
 update public.radar_opportunities set notes='Preservar',stage='Cotizando',favorite=true,verified_closes_at=now()+interval '2 hours' where id=x;
 perform public.radar_closing_alerts(o);perform public.radar_closing_alerts(o);
 if (select count(*) from public.radar_alerts where opportunity_id=x and kind='closing')<>1 then raise exception 'Closing duplicate'; end if;
 perform public.radar_ingest(o,jsonb_build_object('source','compra_agil','code','999-1-COT26','name','Alimentación test','official_status','cancelada','closes_raw','2026-12-02 09:00','profile_ids','[]'::jsonb),jsonb_build_object('test',2),'two');
 if not exists(select 1 from public.radar_opportunities where id=x and notes='Preservar' and stage='Cotizando' and favorite and verified_closes_at is null and official_status='cancelada') then raise exception 'Tracking overwritten'; end if;
 if (select count(*) from public.radar_versions where opportunity_id=x)<>2 then raise exception 'Versions'; end if;
 perform public.radar_enqueue(o,'[{"source":"compra_agil","code":"999-1-COT26","revision":"v1","payload":{}}]');
 if not exists(select 1 from public.radar_pending_candidates(60) where code='999-1-COT26') then raise exception 'Candidate lost'; end if;
 update public.radar_candidates set fetched_revision='v1',fetched_at=now() where code='999-1-COT26';
 if exists(select 1 from public.radar_pending_candidates(60) where code='999-1-COT26') then raise exception 'Fetched repeated'; end if;
 perform public.radar_enqueue(o,'[{"source":"compra_agil","code":"999-1-COT26","revision":"v2","payload":{}}]');
 if not exists(select 1 from public.radar_pending_candidates(60) where code='999-1-COT26') then raise exception 'Changed lost'; end if;
 perform public.radar_release(o,'Upstream failure',300);
 if public.radar_claim(gen_random_uuid(),900) then raise exception 'Ignored pause'; end if;
 raise notice 'Radar: aislamiento, lease, cuota, deduplicación, seguimiento, cierres y reanudación OK';
end $$;
-- Probar el bucket aun ante una política general permisiva.
insert into storage.buckets(id,name,public) values('__radar_test_public__','__radar_test_public__',true);
insert into storage.objects(bucket_id,name) values('radar-documents','test-private'),('__radar_test_public__','test-public');
grant usage on schema storage to authenticated;
grant select,insert on storage.objects to authenticated;
create policy radar_test_storage_permissive on storage.objects for all to authenticated using(true) with check(true);
set local role authenticated;
do $$ begin
 if exists(select 1 from storage.objects where bucket_id='radar-documents') then raise exception 'Private storage exposed'; end if;
 if not exists(select 1 from storage.objects where bucket_id='__radar_test_public__') then raise exception 'Other storage affected'; end if;
 begin
  insert into storage.objects(bucket_id,name) values('radar-documents','forbidden');
  raise exception 'Private upload allowed';
 exception when insufficient_privilege then null; end;
 raise notice 'Radar: Storage privado incluso con política permisiva OK';
end $$;
reset role;
rollback;
