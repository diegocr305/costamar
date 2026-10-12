begin;
set local plpgsql.check_asserts=on;
do $$
declare
 v_owner uuid:=gen_random_uuid();v_staff uuid:=gen_random_uuid();v_other uuid:=gen_random_uuid();v_later uuid:=gen_random_uuid();
 v_email text:='team-'||v_staff||'@example.invalid';v_later_email text:='later-'||v_later||'@example.invalid';v_json jsonb;v_name text:='segment-'||v_staff;
begin
 insert into auth.users(id,email,raw_app_meta_data,email_confirmed_at) values
 (v_owner,'owner-'||v_owner||'@example.invalid','{"role":"superadmin"}',now()),
 (v_staff,v_email,'{}',now()),(v_other,'other-'||v_other||'@example.invalid','{}',now());
 insert into public.user_roles(user_id,role_id) select v_owner,id from public.roles where name='superadmin';
 begin
  perform public.club_set_team_access(v_other,v_email,'Temporal',true);
  raise exception 'TEST_FAILED: no superadmin';
 exception when raise_exception then if sqlerrm<>'TEAM_FORBIDDEN' then raise;end if;end;
 perform public.club_set_team_access(v_owner,upper(v_email),'Temporal',true);
 assert public.club_effective_role(v_staff)='cashier','asigna rol al existente';
 assert (select raw_app_meta_data->>'role' from auth.users where id=v_staff)='cashier','claims sincronizados';
 perform public.club_set_team_access(v_owner,v_email,'Temporal',false);
 assert public.club_effective_role(v_staff)='customer','revocación inmediata';
 perform public.club_set_team_access(v_owner,v_email,'Temporal',true);
 assert public.club_effective_role(v_staff)='cashier','reactiva';
 begin
  perform public.club_set_team_access(v_owner,'owner-'||v_owner||'@example.invalid','Owner',false);
  raise exception 'TEST_FAILED: modifica superadmin';
 exception when raise_exception then if sqlerrm<>'TEAM_PROTECTED' then raise;end if;end;
 perform public.club_set_team_access(v_owner,v_later_email,'Ingreso posterior',true);
 insert into auth.users(id,email,raw_app_meta_data) values(v_later,v_later_email,'{}');
 assert public.club_effective_role(v_later)='customer','email no confirmado no obtiene rol';
 update auth.users set email_confirmed_at=now() where id=v_later;
 assert public.club_effective_role(v_later)='cashier','obtiene rol al confirmar Google';
 assert (select count(*) from public.club_team_audit where actor_id=v_owner)=4,'auditoría';
 insert into public.club_members(user_id,member_code,full_name,phone,birth_date) values
 (v_staff,'TEST-'||v_staff,v_name,'+56912345678',make_date(1990,extract(month from now() at time zone 'America/Santiago')::int,1)),
 (v_other,'TEST-'||v_other,v_name||'-otro','+56912345679','1990-01-01');
 perform public.club_save_preferences(v_staff,'{"commune":" Iquique ","food_preferences":["seafood"],"visit_type":"family","marketing_email":true}');
 v_json:=public.club_segment_members(true,'seafood','family','iquique','email',v_name,1);
 assert (v_json->>'total')::int=1,'filtros combinados y mes Chile';
 assert v_json->'items'->0->>'email'=v_email,'correo autorizado visible';
 assert v_json->'items'->0->>'phone' is null,'sin permiso WhatsApp no muestra teléfono';
 perform public.club_save_preferences(v_staff,'{"marketing_email":false}');
 assert (public.club_segment_members(false,'','','','any',v_name,1)->>'total')::int=0,'revocar excluye de promociones';
 assert (select food_preferences from public.club_member_preferences where user_id=v_staff)=array['seafood'],'no borra gustos al cambiar consentimiento';
 assert not (select granted from public.club_consents where user_id=v_staff and type='marketing'),'consentimiento actualizado';
 assert (select count(*) from public.club_auth_events where user_id=v_staff and event='consent')=2,'historial de consentimiento';
 v_json:=public.club_segment_members(false,'','','','all',v_name,1);
 assert (v_json->>'total')::int=2,'responder preferencias no es barrera';
 assert not has_function_privilege('authenticated','public.club_set_team_access(uuid,text,text,boolean)','EXECUTE'),'no escalación desde cliente';
 assert not has_function_privilege('authenticated','public.club_segment_members(boolean,text,text,text,text,text,integer)','EXECUTE'),'segmentos privados';
 assert not has_function_privilege('anon','public.club_effective_role(uuid)','EXECUTE'),'roles solo backend';
end;
$$;
select 'OK: equipo, pendiente Google, suspensión, protección de roles, filtros, preferencias opcionales y consentimiento' as result;
rollback;
