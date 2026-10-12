alter table public.club_member_preferences
 drop constraint club_member_preferences_visit_type_check,
 add constraint club_member_preferences_visit_type_check check(visit_type in ('','family','couple','friends','alone','not_visited','prefer_not_to_say')),
 add column survey_status text not null default 'not_shown' check(survey_status in ('not_shown','viewed','skipped','responded')),
 add column survey_seen_at timestamptz,
 add column survey_skipped_at timestamptz,
 add column survey_responded_at timestamptz;
-- El socio puede editar preferencias, pero la telemetría se registra en la API.
revoke update on public.club_member_preferences from anon,authenticated;
grant update(marketing_email,marketing_whatsapp,language,updated_at,commune,food_preferences,visit_type) on public.club_member_preferences to authenticated;
-- Respuestas previas se conservan. No inventamos cuándo vieron la encuesta.
update public.club_member_preferences set survey_status='responded'
 where length(btrim(commune))>0 or cardinality(food_preferences)>0 or visit_type<>'';
create table public.club_survey_events(
 user_id uuid not null references public.club_members(user_id) on delete cascade,
 event text not null check(event in ('viewed','skipped','responded')),
 source text not null check(source in ('survey','profile')),
 created_at timestamptz not null default now(),
 primary key(user_id,event)
);
alter table public.club_survey_events enable row level security;
revoke all on public.club_survey_events from anon,authenticated;
grant all on public.club_survey_events to service_role;
create or replace function public.club_save_preferences(p_user_id uuid,p_patch jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.club_member_preferences;
begin
 if not exists(select 1 from public.club_members where user_id=p_user_id) then raise exception 'MEMBER_REQUIRED'; end if;
 insert into public.club_member_preferences(user_id) values(p_user_id) on conflict(user_id) do nothing;
 update public.club_member_preferences set
  commune=case when p_patch ? 'commune' then btrim(p_patch->>'commune') else commune end,
  food_preferences=case when p_patch ? 'food_preferences' then array(select jsonb_array_elements_text(p_patch->'food_preferences')) else food_preferences end,
  visit_type=case when p_patch ? 'visit_type' then p_patch->>'visit_type' else visit_type end,
  marketing_email=case when p_patch ? 'marketing_email' then (p_patch->>'marketing_email')::boolean else marketing_email end,
  marketing_whatsapp=case when p_patch ? 'marketing_whatsapp' then (p_patch->>'marketing_whatsapp')::boolean else marketing_whatsapp end,
  updated_at=now() where user_id=p_user_id returning * into v_row;
 if p_patch ? 'marketing_email' or p_patch ? 'marketing_whatsapp' then
  insert into public.club_consents(user_id,type,version,granted,granted_at)
   values(p_user_id,'marketing','2026-10-11',v_row.marketing_email or v_row.marketing_whatsapp,now())
   on conflict(user_id,type,version) do update set granted=excluded.granted,granted_at=excluded.granted_at;
  insert into public.club_auth_events(user_id,event,meta) values(p_user_id,'consent',jsonb_build_object('marketingEmail',v_row.marketing_email,'marketingWhatsapp',v_row.marketing_whatsapp,'source','profile'));
 end if;
 if (p_patch ? 'commune' or p_patch ? 'food_preferences' or p_patch ? 'visit_type') and
 (length(btrim(v_row.commune))>0 or cardinality(v_row.food_preferences)>0 or v_row.visit_type<>'') then
  update public.club_member_preferences set survey_status='responded',survey_responded_at=coalesce(survey_responded_at,now()) where user_id=p_user_id returning * into v_row;
  insert into public.club_survey_events(user_id,event,source) values(p_user_id,'responded','profile') on conflict(user_id,event) do nothing;
 end if;
 return to_jsonb(v_row);
end;
$$;
revoke all on function public.club_save_preferences(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.club_save_preferences(uuid,jsonb) to service_role;


create function public.club_survey_event(p_user_id uuid,p_action text,p_patch jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.club_member_preferences;
begin
 if p_action not in ('viewed','skipped','responded') or p_action is null then raise exception 'SURVEY_ACTION_INVALID';end if;
 if not exists(select 1 from public.club_members where user_id=p_user_id) then raise exception 'MEMBER_REQUIRED';end if;
 insert into public.club_member_preferences(user_id) values(p_user_id) on conflict(user_id) do nothing;
 select * into v_row from public.club_member_preferences where user_id=p_user_id for update;
 if p_action='responded' then
  if not (length(btrim(coalesce(p_patch->>'commune','')))>0 or jsonb_array_length(coalesce(p_patch->'food_preferences','[]'))>0 or coalesce(p_patch->>'visit_type','')<>'' or coalesce((p_patch->>'marketing_email')::boolean,false) or coalesce((p_patch->>'marketing_whatsapp')::boolean,false)) then raise exception 'SURVEY_EMPTY';end if;
  perform public.club_save_preferences(p_user_id,p_patch);
  update public.club_member_preferences set survey_status='responded',survey_responded_at=coalesce(survey_responded_at,now()) where user_id=p_user_id;
 elsif p_action='viewed' then
  update public.club_member_preferences set survey_status=case when survey_status='not_shown' then 'viewed' else survey_status end,survey_seen_at=coalesce(survey_seen_at,now()) where user_id=p_user_id;
 else
  update public.club_member_preferences set survey_status=case when survey_status='responded' then 'responded' else 'skipped' end,survey_skipped_at=coalesce(survey_skipped_at,now()) where user_id=p_user_id;
 end if;
 insert into public.club_survey_events(user_id,event,source) values(p_user_id,p_action,'survey') on conflict(user_id,event) do nothing;
 select * into v_row from public.club_member_preferences where user_id=p_user_id;
 return to_jsonb(v_row);
end;
$$;
revoke all on function public.club_survey_event(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.club_survey_event(uuid,text,jsonb) to service_role;
create function public.club_segment_members_survey(p_birthday boolean default false,p_food text default '',p_visit text default '',p_commune text default '',p_channel text default 'all',p_q text default '',p_page integer default 1,p_survey_status text default '')
returns jsonb language sql stable security definer set search_path='' as $$
 with filtered as (
  select m.user_id,m.member_code,m.full_name,m.phone,u.email,p.commune,p.food_preferences,p.visit_type,coalesce(p.survey_status,'not_shown') as survey_status,p.survey_seen_at,p.survey_skipped_at,p.survey_responded_at,
   coalesce(p.marketing_email,false) as marketing_email,coalesce(p.marketing_whatsapp,false) as marketing_whatsapp,
   extract(month from m.birth_date)=extract(month from now() at time zone 'America/Santiago') as birthday_month
  from public.club_members m left join public.club_member_preferences p on p.user_id=m.user_id left join auth.users u on u.id=m.user_id
  where m.status='active'
   and (not p_birthday or extract(month from m.birth_date)=extract(month from now() at time zone 'America/Santiago'))
   and (p_survey_status='' or coalesce(p.survey_status,'not_shown')=p_survey_status)
   and (p_food='' or p_food=any(p.food_preferences)) and (p_visit='' or p.visit_type=p_visit)
   and (p_commune='' or lower(p.commune)=lower(btrim(p_commune)))
   and (p_q='' or position(lower(btrim(p_q)) in lower(m.full_name || ' ' || m.member_code))>0)
   and (p_channel='all' or (p_channel='email' and p.marketing_email) or (p_channel='whatsapp' and p.marketing_whatsapp) or (p_channel='any' and (p.marketing_email or p.marketing_whatsapp)))
 ), paged as (select * from filtered order by full_name,user_id limit 20 offset (greatest(1,least(p_page,100000))-1)*20)
 select jsonb_build_object('total',(select count(*) from filtered),'page',greatest(1,least(p_page,100000)),'pageSize',20,'items',coalesce((select jsonb_agg(jsonb_build_object(
  'memberCode',f.member_code,'fullName',f.full_name,'commune',coalesce(f.commune,''),'foodPreferences',coalesce(f.food_preferences,'{}'::text[]),'visitType',coalesce(f.visit_type,''),
  'surveyStatus',f.survey_status,'surveySeenAt',f.survey_seen_at,'surveySkippedAt',f.survey_skipped_at,'surveyRespondedAt',f.survey_responded_at,
  'birthdayMonth',coalesce(f.birthday_month,false),'marketingEmail',f.marketing_email,'marketingWhatsapp',f.marketing_whatsapp,
  'email',case when f.marketing_email then f.email else null end,'phone',case when f.marketing_whatsapp then f.phone else null end
 ) order by f.full_name,f.user_id) from paged f),'[]'::jsonb));
$$;
revoke all on function public.club_segment_members_survey(boolean,text,text,text,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.club_segment_members_survey(boolean,text,text,text,text,text,integer,text) to service_role;


