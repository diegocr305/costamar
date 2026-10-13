begin;
update public.radar_control set queued=true,owner=null,lease_until=null,blocked_until=null,last_attempt_at=null,general_next_request_at=null where id=1;
do $$ declare o uuid:=gen_random_uuid(); p uuid; x uuid; v_owner uuid; v_actor uuid; v_manual uuid; begin
 if has_table_privilege('authenticated','public.radar_general_cache','select') then raise exception 'General cache exposed'; end if;
 if has_function_privilege('authenticated','public.radar_import_general(uuid,jsonb,jsonb,text)','execute') then raise exception 'General import exposed'; end if;
 if not public.radar_general_consume() then raise exception 'Initial manual quota'; end if;
 if public.radar_general_consume() then raise exception 'Manual requests unthrottled'; end if;
 if not public.radar_claim(o,900) then raise exception 'Worker blocked by general read'; end if;
 select id into p from public.radar_profiles limit 1;
 x:=public.radar_ingest(o,jsonb_build_object('source','compra_agil','code','999-2-COT26','name','Jornada','official_status','publicada','profile_ids',jsonb_build_array(p),'match_kind','review','match_reasons',jsonb_build_array('Título ambiguo')),jsonb_build_object('name','Jornada'),'review1');
 if not exists(select 1 from public.radar_opportunities where id=x and match_kind='review' and cardinality(profile_ids)=1) then raise exception 'Doubtful process lost'; end if;
 if exists(select 1 from public.radar_alerts where opportunity_id=x) then raise exception 'Doubtful auto-alert'; end if;
 update public.radar_opportunities set notes='Conservar',favorite=true,stage='Analizando' where id=x;
 perform public.radar_ingest(o,jsonb_build_object('source','compra_agil','code','999-2-COT26','name','Colación','official_status','publicada','profile_ids',jsonb_build_array(p),'match_kind','matched'),jsonb_build_object('name','Colación'),'matched2');
 if not exists(select 1 from public.radar_opportunities where id=x and notes='Conservar' and favorite and stage='Analizando' and match_kind='matched') then raise exception 'Manual tracking lost'; end if;
 select id into v_actor from public.profiles where public.club_effective_role(id) in ('superadmin','admin') limit 1;
 if v_actor is null then raise exception 'Se requiere un administrador existente para probar importación manual.'; end if;
 v_manual:=public.radar_import_general(v_actor,jsonb_build_object('source','compra_agil','code','999-3-COT26','name','Compra de oficina','official_status','publicada','match_kind','manual','profile_ids','[]'::jsonb),'{}','manual1');
 if not exists(select 1 from public.radar_control where owner=o) then raise exception 'Manual import changed worker lease'; end if;
 if not exists(select 1 from public.radar_opportunities where id=v_manual and manual_selected and match_kind='manual') then raise exception 'General import lost'; end if;
 perform public.radar_general_pause(300,'429');perform public.radar_release(o);
 if not exists(select 1 from public.radar_control where blocked_until>now() and last_error='429') then raise exception 'General pause erased by worker'; end if;
 if public.radar_general_consume() then raise exception 'Ignored global pause'; end if;
 perform public.radar_import_general(v_actor,jsonb_build_object('source','compra_agil','code','999-3-COT26','name','Compra de oficina','official_status','publicada','match_kind','manual','profile_ids','[]'::jsonb),'{}','manual1');
 if exists(select 1 from public.radar_control where owner is not null) then raise exception 'Temporary lease retained'; end if;
 if (select count(*) from public.radar_versions where opportunity_id=v_manual)<>1 then raise exception 'Manual import duplicated'; end if;
 -- La función manual verifica el rol vigente aun usando service_role.
 begin
  perform public.radar_import_general(gen_random_uuid(),jsonb_build_object('source','compra_agil','code','999-3-COT26','name','Compra general','official_status','publicada'),'{}','general');
  raise exception 'Forbidden actor accepted';
 exception when others then if sqlerrm<>'RADAR_FORBIDDEN' then raise; end if; end;
 raise notice 'Radar general: cache privado, cuota compartida, dudas sin alertas, seguimiento y pausa OK';
end $$;
rollback;
