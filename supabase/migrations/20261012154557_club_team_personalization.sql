-- Autorizaciones del equipo: sin contraseñas ni envío automático de correos.
create table public.club_team_access (
 email text primary key check (email = lower(btrim(email))),
 full_name text not null check (length(btrim(full_name)) between 1 and 120),
 is_active boolean not null default true,
 granted_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now()
);
alter table public.club_team_access enable row level security;
revoke all on public.club_team_access from anon, authenticated;
grant all on public.club_team_access to service_role;

create table public.club_team_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null references public.profiles(id),
 email text not null, is_active boolean not null,
 created_at timestamptz not null default now()
);
alter table public.club_team_audit enable row level security;
revoke all on public.club_team_audit from anon, authenticated;
grant select,insert on public.club_team_audit to service_role;
grant usage,select on sequence public.club_team_audit_id_seq to service_role;

create function public.club_effective_role(p_user_id uuid) returns text
language sql stable security definer set search_path = '' as $$
 select coalesce((select r.name from public.user_roles ur join public.roles r on r.id=ur.role_id
 where ur.user_id=p_user_id order by case r.name when 'superadmin' then 0 when 'admin' then 1 when 'manager' then 2 when 'cashier' then 3 else 4 end limit 1),'customer');
$$;
revoke all on function public.club_effective_role(uuid) from public,anon,authenticated;
grant execute on function public.club_effective_role(uuid) to service_role;

create function public.club_set_team_access(p_actor_id uuid,p_email text,p_full_name text,p_is_active boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(p_email)); v_user uuid; v_role text;
begin
 if public.club_effective_role(p_actor_id) <> 'superadmin' then raise exception 'TEAM_FORBIDDEN'; end if;
 if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 or length(btrim(p_full_name)) not between 1 and 120 or p_is_active is null then raise exception 'TEAM_INVALID'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,0));
 select id into v_user from auth.users where lower(email)=v_email;
 if v_user is not null then
  v_role := public.club_effective_role(v_user);
  if v_role not in ('customer','cashier') or v_user=p_actor_id then raise exception 'TEAM_PROTECTED'; end if;
 end if;
 insert into public.club_team_access(email,full_name,is_active,granted_by) values(v_email,btrim(p_full_name),p_is_active,p_actor_id)
 on conflict(email) do update set full_name=excluded.full_name,is_active=excluded.is_active,granted_by=excluded.granted_by,updated_at=now();
 if v_user is not null then
  delete from public.user_roles where user_id=v_user;
  if p_is_active then
   insert into public.user_roles(user_id,role_id,granted_by) select v_user,id,p_actor_id from public.roles where name='cashier';
  end if;
  update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}') || jsonb_build_object('role',case when p_is_active then 'cashier' else 'customer' end) where id=v_user;
 end if;
 insert into public.club_team_audit(actor_id,email,is_active) values(p_actor_id,v_email,p_is_active);
 return jsonb_build_object('email',v_email,'fullName',btrim(p_full_name),'isActive',p_is_active,'hasAccount',v_user is not null);
end;
$$;
revoke all on function public.club_set_team_access(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.club_set_team_access(uuid,text,text,boolean) to service_role;

create function public.club_apply_team_on_login() returns trigger language plpgsql security definer set search_path='' as $$
declare v_team public.club_team_access;
begin
 if new.email_confirmed_at is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(new.email),0));
 select * into v_team from public.club_team_access where email=lower(new.email) and is_active;
 if not found then return new; end if;
 if public.club_effective_role(new.id) not in ('customer','cashier') then return new; end if;
 insert into public.user_roles(user_id,role_id,granted_by) select new.id,id,v_team.granted_by from public.roles where name='cashier' on conflict do nothing;
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}') || jsonb_build_object('role','cashier') where id=new.id;
 return new;
end;
$$;
revoke all on function public.club_apply_team_on_login() from public,anon,authenticated;
-- Después de los triggers que crean profiles y el superadmin designado.
create trigger zz_club_team_access after insert or update of email,email_confirmed_at on auth.users for each row execute function public.club_apply_team_on_login();

-- Incluye al personal ya autorizado, sin modificar sus roles.
insert into public.club_team_access(email,full_name,granted_by)
select lower(u.email),coalesce(nullif(p.full_name,''),'Equipo Costa Mar'),owner.user_id
from public.user_roles ur join public.roles r on r.id=ur.role_id
join auth.users u on u.id=ur.user_id join public.profiles p on p.id=u.id
cross join lateral (select a.user_id from public.user_roles a join public.roles ar on ar.id=a.role_id where ar.name='superadmin' limit 1) owner
where r.name='cashier' and u.email is not null;

alter table public.club_member_preferences
 add column commune text not null default '' check(length(commune)<=80),
 add column food_preferences text[] not null default '{}' check(food_preferences <@ array['seafood','hot_dishes','drinks','desserts']::text[] and cardinality(food_preferences)<=4),
 add column visit_type text not null default '' check(visit_type in ('','family','couple','friends','alone','prefer_not_to_say'));

create function public.club_list_team() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('email',t.email,'fullName',t.full_name,'isActive',t.is_active,'hasAccount',exists(select 1 from auth.users u where lower(u.email)=t.email),'updatedAt',t.updated_at) order by t.full_name),'[]') from public.club_team_access t;
$$;
revoke all on function public.club_list_team() from public,anon,authenticated;
grant execute on function public.club_list_team() to service_role;

create function public.club_segment_members(p_birthday boolean default false,p_food text default '',p_visit text default '',p_commune text default '',p_channel text default 'all',p_q text default '',p_page integer default 1)
returns jsonb language sql stable security definer set search_path='' as $$
 with filtered as (
  select m.user_id,m.member_code,m.full_name,m.phone,u.email,p.commune,p.food_preferences,p.visit_type,
   coalesce(p.marketing_email,false) as marketing_email,coalesce(p.marketing_whatsapp,false) as marketing_whatsapp,
   extract(month from m.birth_date)=extract(month from now() at time zone 'America/Santiago') as birthday_month
  from public.club_members m left join public.club_member_preferences p on p.user_id=m.user_id left join auth.users u on u.id=m.user_id
  where m.status='active'
   and (not p_birthday or extract(month from m.birth_date)=extract(month from now() at time zone 'America/Santiago'))
   and (p_food='' or p_food=any(p.food_preferences)) and (p_visit='' or p.visit_type=p_visit)
   and (p_commune='' or lower(p.commune)=lower(btrim(p_commune)))
   and (p_q='' or position(lower(btrim(p_q)) in lower(m.full_name || ' ' || m.member_code))>0)
   and (p_channel='all' or (p_channel='email' and p.marketing_email) or (p_channel='whatsapp' and p.marketing_whatsapp) or (p_channel='any' and (p.marketing_email or p.marketing_whatsapp)))
 ), paged as (select * from filtered order by full_name,user_id limit 20 offset (greatest(1,least(p_page,100000))-1)*20)
 select jsonb_build_object('total',(select count(*) from filtered),'page',greatest(1,least(p_page,100000)),'pageSize',20,'items',coalesce((select jsonb_agg(jsonb_build_object(
  'memberCode',f.member_code,'fullName',f.full_name,'commune',coalesce(f.commune,''),'foodPreferences',coalesce(f.food_preferences,'{}'::text[]),'visitType',coalesce(f.visit_type,''),
  'birthdayMonth',coalesce(f.birthday_month,false),'marketingEmail',f.marketing_email,'marketingWhatsapp',f.marketing_whatsapp,
  'email',case when f.marketing_email then f.email else null end,'phone',case when f.marketing_whatsapp then f.phone else null end
 ) order by f.full_name,f.user_id) from paged f),'[]'::jsonb));
$$;
revoke all on function public.club_segment_members(boolean,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.club_segment_members(boolean,text,text,text,text,text,integer) to service_role;

create function public.club_save_preferences(p_user_id uuid,p_patch jsonb) returns jsonb
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
 return to_jsonb(v_row);
end;
$$;
revoke all on function public.club_save_preferences(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.club_save_preferences(uuid,jsonb) to service_role;
