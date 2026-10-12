begin;
set local plpgsql.check_asserts=on;
do $$
declare v_user uuid:=gen_random_uuid();v_name text:='survey-'||v_user;v_row jsonb;v_count bigint;
begin
 insert into auth.users(id,email) values(v_user,'survey-'||v_user||'@example.invalid');
 insert into public.club_members(user_id,member_code,full_name,phone,birth_date) values(v_user,'TEST-'||v_user,v_name,'+56912345678','1990-01-01');
 select count(*) into v_count from public.club_coupons;
 assert (public.club_segment_members_survey(false,'','','','all',v_name,1,'not_shown')->>'total')::int=1,'sin mostrar incluye sin fila de preferencias';
 v_row:=public.club_survey_event(v_user,'viewed');
 assert v_row->>'survey_status'='viewed' and v_row->>'survey_seen_at' is not null,'vista registrada';
 perform public.club_survey_event(v_user,'viewed');
 assert (select count(*) from public.club_survey_events where user_id=v_user)=1,'vista idempotente';
 v_row:=public.club_survey_event(v_user,'skipped');
 assert v_row->>'survey_status'='skipped' and v_row->>'survey_skipped_at' is not null,'omisión explícita';
 perform public.club_survey_event(v_user,'viewed');
 assert (select survey_status from public.club_member_preferences where user_id=v_user)='skipped','vista tardía no revierte omisión';
 begin
  perform public.club_survey_event(v_user,'responded','{"commune":"","food_preferences":[],"visit_type":"","marketing_email":false,"marketing_whatsapp":false}');
  raise exception 'TEST_FAILED: encuesta vacía';
 exception when raise_exception then if sqlerrm<>'SURVEY_EMPTY' then raise;end if;end;
 assert (select survey_status from public.club_member_preferences where user_id=v_user)='skipped','vacío no se marca respondido';
 v_row:=public.club_survey_event(v_user,'responded','{"visit_type":"not_visited","food_preferences":["seafood"],"marketing_email":false,"marketing_whatsapp":false}');
 assert v_row->>'survey_status'='responded' and v_row->>'visit_type'='not_visited','nueva opción y respuesta parcial';
 assert not (v_row->>'marketing_email')::boolean and not (v_row->>'marketing_whatsapp')::boolean,'responder no implica consentimiento';
 assert (public.club_segment_members_survey(false,'','not_visited','','all',v_name,1,'responded')->>'total')::int=1,'admin filtra estado y tipo';
 perform public.club_survey_event(v_user,'skipped');
 assert (select survey_status from public.club_member_preferences where user_id=v_user)='responded','no degrada respuesta guardada';
 perform public.club_save_preferences(v_user,'{"visit_type":"","food_preferences":[]}');
 assert (select survey_status from public.club_member_preferences where user_id=v_user)='responded','borrar preferencias conserva participación histórica';
 assert (select count(*) from public.club_coupons)=v_count,'no altera regalos ni cupos';
 assert not has_function_privilege('authenticated','public.club_survey_event(uuid,text,jsonb)','EXECUTE'),'RPC solo backend';
 assert not has_column_privilege('authenticated','public.club_member_preferences','survey_status','UPDATE'),'cliente no falsifica estado';
 assert has_column_privilege('authenticated','public.club_member_preferences','commune','UPDATE'),'conserva edición permitida';
 assert not has_table_privilege('authenticated','public.club_survey_events','INSERT'),'eventos cerrados al cliente';
end;
$$;
select 'OK: vista real, omisión, vacío, respuestas parciales, filtros, consentimiento, idempotencia, permisos y regalos intactos' as result;
rollback;
