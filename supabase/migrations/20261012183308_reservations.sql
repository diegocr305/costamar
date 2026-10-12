create table public.reservation_settings(
 id boolean primary key default true check(id),
 duration_small integer not null default 90 check(duration_small between 30 and 240),
 duration_large integer not null default 120 check(duration_large between 30 and 360),
 buffer_minutes integer not null default 15 check(buffer_minutes between 0 and 60),
 tolerance_minutes integer not null default 15 check(tolerance_minutes between 0 and 60),
 advance_minutes integer not null default 120 check(advance_minutes between 0 and 1440),
 updated_at timestamptz not null default now()
);
insert into public.reservation_settings(id) values(true);
create table public.reservation_hours(day integer primary key check(day between 0 and 6),opens time not null,closes time not null,is_open boolean not null default true,check(closes>opens));
insert into public.reservation_hours(day,opens,closes) values(0,'12:00','18:00'),(1,'12:00','19:00'),(2,'12:00','19:00'),(3,'12:00','19:00'),(4,'12:00','19:00'),(5,'12:00','22:00'),(6,'12:00','22:00');
create table public.reservation_tables(number integer primary key,area text not null check(area in ('salon','terraza','barra')),comfortable integer not null check(comfortable>0),maximum integer not null check(maximum>=comfortable));
insert into public.reservation_tables(number,area,comfortable,maximum)
select n,'salon',case when n in (1,2,3,4,5,6,7,8,10,12,15) then 2 else 4 end,case when n in (1,2,3,4,5,6,7,8,10,12,15) then 3 else 4 end from generate_series(1,19) n;
insert into public.reservation_tables values(20,'terraza',2,2),(21,'terraza',2,2),(22,'terraza',2,2),(23,'terraza',2,2),(30,'barra',2,2),(31,'barra',2,2),(32,'barra',2,2);
create table public.reservation_pairs(a integer references public.reservation_tables(number),b integer references public.reservation_tables(number),capacity integer check(capacity>0),primary key(a,b),check(a<b));
insert into public.reservation_pairs values(1,2,6),(3,4,6),(5,6,6),(7,8,6),(10,12,null),(12,14,null),(14,16,null),(16,18,null),(9,11,null),(11,13,null),(13,17,null),(17,19,null);

create table public.reservations(
 id uuid primary key default gen_random_uuid(),folio bigint generated always as identity unique,
 request_key uuid not null unique,access_hash text not null check(length(access_hash)=64),
 user_id uuid references auth.users(id) on delete set null,
 customer_name text not null check(length(btrim(customer_name)) between 1 and 120),
 customer_phone text not null check(customer_phone ~ '^\+569[0-9]{8}$'),
 party_size integer not null check(party_size between 1 and 100),reserved_at timestamptz not null,
 duration_minutes integer not null,buffer_minutes integer not null,tolerance_minutes integer not null,
 status text not null default 'pending' check(status in ('pending','confirmed','seated','completed','cancelled','no_show')),
 area_preference text not null default 'any' check(area_preference in ('any','salon','terraza','barra')),
 table_numbers integer[] not null default '{}',confirmed_capacity integer,
 notes text not null default '' check(length(notes)<=500),staff_note text not null default '' check(length(staff_note)<=500),
 source text not null check(source in ('web','club','admin')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status not in ('confirmed','seated','completed') or (cardinality(table_numbers)>0 and confirmed_capacity>=party_size))
);
create index reservations_date_idx on public.reservations(reserved_at,status);
create index reservations_user_idx on public.reservations(user_id,reserved_at desc);
create index reservations_tables_idx on public.reservations using gin(table_numbers);
create table public.reservation_events(id bigint generated always as identity primary key,reservation_id uuid not null references public.reservations(id) on delete cascade,actor_id uuid references auth.users(id) on delete set null,event text not null,meta jsonb not null default '{}',created_at timestamptz not null default now());
create index reservation_events_reservation_idx on public.reservation_events(reservation_id,created_at);
do $$declare t text;begin
 foreach t in array array['reservation_settings','reservation_hours','reservation_tables','reservation_pairs','reservations','reservation_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end;$$;
grant usage,select on sequence public.reservations_folio_seq,public.reservation_events_id_seq to service_role;

create function public.reservation_view(p_id uuid,p_staff boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'reference','RES-'||lpad(r.folio::text,greatest(6,length(r.folio::text)),'0'),'customerName',r.customer_name,'customerPhone',r.customer_phone,'partySize',r.party_size,'reservedAt',r.reserved_at,'durationMinutes',r.duration_minutes,'bufferMinutes',r.buffer_minutes,'toleranceMinutes',r.tolerance_minutes,'status',r.status,'areaPreference',r.area_preference,'tableNumbers',r.table_numbers,'confirmedCapacity',r.confirmed_capacity,'notes',r.notes,'source',r.source,'createdAt',r.created_at,'updatedAt',r.updated_at)
 || case when p_staff then jsonb_build_object('staffNote',r.staff_note,'events',coalesce((select jsonb_agg(jsonb_build_object('event',e.event,'actorName',coalesce(p.full_name,'Cliente'),'createdAt',e.created_at,'meta',e.meta) order by e.created_at,e.id) from public.reservation_events e left join public.profiles p on p.id=e.actor_id where e.reservation_id=r.id),'[]'::jsonb)) else '{}'::jsonb end
 from public.reservations r where r.id=p_id;
$$;

create function public.reservation_config(p_staff boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('durationSmall',s.duration_small,'durationLarge',s.duration_large,'bufferMinutes',s.buffer_minutes,'toleranceMinutes',s.tolerance_minutes,'advanceMinutes',s.advance_minutes,'hours',(select jsonb_agg(jsonb_build_object('day',day,'opens',to_char(opens,'HH24:MI'),'closes',to_char(closes,'HH24:MI'),'isOpen',is_open) order by day) from public.reservation_hours))
 || case when p_staff then jsonb_build_object('tables',(select jsonb_agg(jsonb_build_object('number',number,'area',area,'comfortable',comfortable,'maximum',maximum) order by number) from public.reservation_tables),'pairs',(select jsonb_agg(jsonb_build_object('a',a,'b',b,'capacity',capacity) order by a,b) from public.reservation_pairs)) else '{}'::jsonb end
 from public.reservation_settings s;
$$;

create function public.reservation_validate_time(p_at timestamptz,p_party integer,p_manual boolean) returns integer language plpgsql stable security definer set search_path='' as $$
declare v_local timestamp:=p_at at time zone 'America/Santiago';v_duration integer;v_hours public.reservation_hours;v_settings public.reservation_settings;
begin
 select * into v_settings from public.reservation_settings;
 v_duration:=case when p_party<=4 then v_settings.duration_small else v_settings.duration_large end;
 select * into v_hours from public.reservation_hours where day=extract(dow from v_local)::integer;
 if not v_hours.is_open or v_local::time<v_hours.opens or (v_local + make_interval(mins=>v_duration))::date<>v_local::date or (v_local+make_interval(mins=>v_duration))::time>v_hours.closes then raise exception 'RESERVATION_HOURS';end if;
 if p_at < now()+(case when p_manual then interval '-15 minutes' else make_interval(mins=>v_settings.advance_minutes) end) then raise exception 'RESERVATION_ADVANCE';end if;
 if not p_manual and (extract(minute from v_local)::int not in (0,30) or extract(second from v_local)<>0) then raise exception 'RESERVATION_SLOT';end if;
 return v_duration;
end;
$$;

create function public.reservation_create(p_user uuid,p_manual boolean,p_input jsonb,p_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_existing public.reservations;v_settings public.reservation_settings;v_at timestamptz:=(p_input->>'reservedAt')::timestamptz;v_party integer:=(p_input->>'partySize')::integer;v_duration integer;v_phone text:=p_input->>'customerPhone';
begin
 perform pg_advisory_xact_lock(7153241);
 if p_manual and public.club_effective_role(p_user) not in ('superadmin','admin','manager','cashier') then raise exception 'RESERVATION_FORBIDDEN';end if;
 select * into v_existing from public.reservations where request_key=(p_input->>'requestId')::uuid;
 if found then
  if v_existing.access_hash<>p_hash or v_existing.user_id is distinct from (case when p_manual then null else p_user end) then raise exception 'RESERVATION_REQUEST_CONFLICT';end if;
  if v_existing.customer_name<>btrim(p_input->>'customerName') or v_existing.customer_phone<>v_phone or v_existing.party_size<>v_party or v_existing.reserved_at<>v_at then raise exception 'RESERVATION_REQUEST_CONFLICT';end if;
  return public.reservation_view(v_existing.id,p_manual);
 end if;
 if exists(select 1 from public.reservations where customer_phone=v_phone and reserved_at=v_at and status in ('pending','confirmed','seated')) then raise exception 'RESERVATION_DUPLICATE';end if;
 v_duration:=public.reservation_validate_time(v_at,v_party,p_manual);
 select * into v_settings from public.reservation_settings;
 insert into public.reservations(id,request_key,access_hash,user_id,customer_name,customer_phone,party_size,reserved_at,duration_minutes,buffer_minutes,tolerance_minutes,area_preference,notes,source)
 values((p_input->>'requestId')::uuid,(p_input->>'requestId')::uuid,p_hash,case when p_manual then null else p_user end,btrim(p_input->>'customerName'),v_phone,v_party,v_at,v_duration,v_settings.buffer_minutes,v_settings.tolerance_minutes,coalesce(p_input->>'areaPreference','any'),coalesce(p_input->>'notes',''),case when p_manual then 'admin' when p_user is null then 'web' else 'club' end) returning id into v_id;
 insert into public.reservation_events(reservation_id,actor_id,event) values(v_id,p_user,'created');
 return public.reservation_view(v_id,p_manual);
end;
$$;

create function public.reservation_update(p_actor uuid,p_id uuid,p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.reservations;v_new public.reservations;v_role text:=public.club_effective_role(p_actor);v_numbers integer[];v_seen integer[];v_number integer;v_changed boolean;v_max integer;v_capacity integer;v_pair_capacity integer;v_settings public.reservation_settings;
begin
 if v_role not in ('superadmin','admin','manager','cashier') then raise exception 'RESERVATION_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(7153241);
 select * into v_old from public.reservations where id=p_id for update;
 if not found then raise exception 'RESERVATION_NOT_FOUND';end if;
 if v_old.status in ('completed','cancelled','no_show') then raise exception 'RESERVATION_FINAL';end if;
 v_new:=v_old;
 if p_patch ? 'status' then v_new.status:=p_patch->>'status';end if;
 if (v_old.status='pending' and v_new.status not in ('pending','confirmed','cancelled')) or
 (v_old.status='confirmed' and v_new.status not in ('confirmed','seated','cancelled','no_show')) or
 (v_old.status='seated' and v_new.status not in ('seated','completed')) then raise exception 'RESERVATION_TRANSITION';end if;
 if v_new.status='no_show' and now()<v_old.reserved_at+make_interval(mins=>v_old.tolerance_minutes) then raise exception 'RESERVATION_TOLERANCE';end if;
 if v_new.status='seated' and (now()<v_old.reserved_at-interval '15 minutes' or (v_old.reserved_at at time zone 'America/Santiago')::date<>(now() at time zone 'America/Santiago')::date) then raise exception 'RESERVATION_ARRIVAL_TIME';end if;
 if p_patch ? 'partySize' then v_new.party_size:=(p_patch->>'partySize')::int;end if;
 if p_patch ? 'reservedAt' then v_new.reserved_at:=(p_patch->>'reservedAt')::timestamptz;end if;
 if p_patch ? 'staffNote' then v_new.staff_note:=coalesce(p_patch->>'staffNote','');end if;
 if p_patch ? 'tableNumbers' then v_new.table_numbers:=array(select distinct value::integer from jsonb_array_elements_text(p_patch->'tableNumbers') order by value::integer);end if;
 if v_old.status='seated' and (v_new.reserved_at<>v_old.reserved_at or v_new.party_size<>v_old.party_size or v_new.table_numbers<>v_old.table_numbers) then raise exception 'RESERVATION_SEATED_CHANGE';end if;
 v_changed:=v_new.reserved_at<>v_old.reserved_at or v_new.party_size<>v_old.party_size;
 if v_changed then
  v_new.duration_minutes:=public.reservation_validate_time(v_new.reserved_at,v_new.party_size,true);
  select * into v_settings from public.reservation_settings;
  v_new.buffer_minutes:=v_settings.buffer_minutes;v_new.tolerance_minutes:=v_settings.tolerance_minutes;
 end if;
 if v_new.status in ('confirmed','seated') then
  if v_new.status='confirmed' and v_old.status='pending' and v_new.reserved_at<now()-interval '15 minutes' then raise exception 'RESERVATION_ADVANCE';end if;
  if cardinality(v_new.table_numbers)=0 then raise exception 'RESERVATION_TABLE_REQUIRED';end if;
  if cardinality(v_new.table_numbers)>2 and v_role='cashier' then raise exception 'RESERVATION_SPECIAL_GROUP';end if;
  if (select count(*) from public.reservation_tables where number=any(v_new.table_numbers))<>cardinality(v_new.table_numbers) or (select count(distinct area) from public.reservation_tables where number=any(v_new.table_numbers))<>1 then raise exception 'RESERVATION_TABLE_INVALID';end if;
  if cardinality(v_new.table_numbers)>1 then
   v_seen:=array[v_new.table_numbers[1]];
   loop
    v_changed:=false;
    foreach v_number in array v_new.table_numbers loop
     if not v_number=any(v_seen) and exists(select 1 from public.reservation_pairs where (a=v_number and b=any(v_seen)) or (b=v_number and a=any(v_seen))) then v_seen:=array_append(v_seen,v_number);v_changed:=true;end if;
    end loop;
    exit when not v_changed;
   end loop;
   if cardinality(v_seen)<>cardinality(v_new.table_numbers) then raise exception 'RESERVATION_PAIR_INVALID';end if;
  end if;
  select sum(maximum) into v_max from public.reservation_tables where number=any(v_new.table_numbers);
  if cardinality(v_new.table_numbers)=1 then v_capacity:=v_max;
  else
   select capacity into v_pair_capacity from public.reservation_pairs where a=v_new.table_numbers[1] and b=v_new.table_numbers[2] and cardinality(v_new.table_numbers)=2;
   v_capacity:=coalesce(v_pair_capacity,case when p_patch ? 'confirmedCapacity' then (p_patch->>'confirmedCapacity')::int when v_new.table_numbers=v_old.table_numbers then v_old.confirmed_capacity else null end);
   if v_capacity is null then raise exception 'RESERVATION_CAPACITY_REVIEW';end if;
  end if;
  if v_capacity>v_max or v_capacity<v_new.party_size then raise exception 'RESERVATION_CAPACITY';end if;
  v_new.confirmed_capacity:=v_capacity;
  if exists(select 1 from public.reservations r where r.id<>p_id and r.status in ('confirmed','seated') and r.table_numbers && v_new.table_numbers
   and r.reserved_at < v_new.reserved_at+make_interval(mins=>v_new.duration_minutes+v_new.buffer_minutes)
   and v_new.reserved_at < r.reserved_at+make_interval(mins=>r.duration_minutes+r.buffer_minutes)) then raise exception 'RESERVATION_OVERLAP';end if;
  if v_new.status='seated' and exists(select 1 from public.reservations r where r.id<>p_id and r.status='seated' and r.table_numbers && v_new.table_numbers) then raise exception 'RESERVATION_STILL_SEATED';end if;
 end if;
 update public.reservations set status=v_new.status,party_size=v_new.party_size,reserved_at=v_new.reserved_at,duration_minutes=v_new.duration_minutes,buffer_minutes=v_new.buffer_minutes,tolerance_minutes=v_new.tolerance_minutes,table_numbers=v_new.table_numbers,confirmed_capacity=v_new.confirmed_capacity,staff_note=v_new.staff_note,updated_at=now() where id=p_id;
 insert into public.reservation_events(reservation_id,actor_id,event,meta) values(p_id,p_actor,'staff_update',jsonb_build_object('previousStatus',v_old.status,'status',v_new.status,'tables',v_new.table_numbers,'previousTables',v_old.table_numbers,'partySize',v_new.party_size,'reservedAt',v_new.reserved_at,'confirmedCapacity',v_new.confirmed_capacity,'staffNote',v_new.staff_note));
 return public.reservation_view(p_id,true);
end;
$$;

create function public.reservation_customer_access(p_id uuid,p_user uuid,p_hash text,p_cancel boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row public.reservations;
begin
 if p_cancel then perform pg_advisory_xact_lock(7153241);end if;
 select * into v_row from public.reservations where id=p_id;
 if not found or not (coalesce(p_user=v_row.user_id,false) or coalesce(p_hash=v_row.access_hash,false)) then raise exception 'RESERVATION_NOT_FOUND';end if;
 if p_cancel then
  if v_row.status='cancelled' then return public.reservation_view(p_id);end if;
  if v_row.status not in ('pending','confirmed') or v_row.reserved_at<=now() then raise exception 'RESERVATION_CANCEL';end if;
  update public.reservations set status='cancelled',updated_at=now() where id=p_id;
  insert into public.reservation_events(reservation_id,actor_id,event) values(p_id,p_user,'customer_cancel');
 end if;
 return public.reservation_view(p_id);
end;
$$;

create function public.reservation_list(p_actor uuid,p_staff boolean,p_date date default null,p_status text default '',p_query text default '',p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;begin
 if p_staff and public.club_effective_role(p_actor) not in ('superadmin','admin','manager','cashier') then raise exception 'RESERVATION_FORBIDDEN';end if;
 if p_actor is null then raise exception 'RESERVATION_FORBIDDEN';end if;
 with filtered as (select r.id,r.reserved_at from public.reservations r where (p_staff or r.user_id=p_actor)
  and (p_date is null or (r.reserved_at >= p_date::timestamp at time zone 'America/Santiago' and r.reserved_at < (p_date+1)::timestamp at time zone 'America/Santiago'))
  and (p_status='' or r.status=p_status) and (p_query='' or position(lower(btrim(p_query)) in lower(r.customer_name||' '||r.customer_phone||' RES-'||lpad(r.folio::text,greatest(6,length(r.folio::text)),'0')))>0)),
 paged as (select * from filtered order by reserved_at,id limit 20 offset (greatest(1,p_page)-1)*20)
 select jsonb_build_object('total',(select count(*) from filtered),'page',greatest(1,p_page),'pageSize',20,'items',coalesce((select jsonb_agg(public.reservation_view(id,p_staff) order by reserved_at) from paged),'[]'::jsonb)) into v_result;
 return v_result;
end;$$;

create function public.reservation_save_config(p_actor uuid,p_config jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_item jsonb;
begin
 if public.club_effective_role(p_actor)<>'superadmin' then raise exception 'RESERVATION_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(7153241);
 update public.reservation_settings set duration_small=(p_config->>'durationSmall')::int,duration_large=(p_config->>'durationLarge')::int,buffer_minutes=(p_config->>'bufferMinutes')::int,tolerance_minutes=(p_config->>'toleranceMinutes')::int,advance_minutes=(p_config->>'advanceMinutes')::int,updated_at=now();

 for v_item in select value from jsonb_array_elements(p_config->'hours') loop
  update public.reservation_hours set opens=(v_item->>'opens')::time,closes=(v_item->>'closes')::time,is_open=(v_item->>'isOpen')::boolean where day=(v_item->>'day')::int;
 end loop;
 for v_item in select value from jsonb_array_elements(p_config->'tables') loop
  update public.reservation_tables set comfortable=(v_item->>'comfortable')::int,maximum=(v_item->>'maximum')::int where number=(v_item->>'number')::int;
 end loop;
 for v_item in select value from jsonb_array_elements(p_config->'pairs') loop
  if (v_item->>'capacity')::int > (select sum(maximum) from public.reservation_tables where number in ((v_item->>'a')::int,(v_item->>'b')::int)) then raise exception 'RESERVATION_CAPACITY';end if;
  update public.reservation_pairs set capacity=(v_item->>'capacity')::int where a=(v_item->>'a')::int and b=(v_item->>'b')::int;
 end loop;
 insert into public.reservation_config_audit(actor_id,config) values(p_actor,p_config);
 return public.reservation_config(true);
end;$$;
create table public.reservation_config_audit(id bigint generated always as identity primary key,actor_id uuid references auth.users(id) on delete set null,config jsonb not null,created_at timestamptz not null default now());
alter table public.reservation_config_audit enable row level security;
revoke all on public.reservation_config_audit from anon,authenticated;
grant all on public.reservation_config_audit to service_role;
grant usage,select on sequence public.reservation_config_audit_id_seq to service_role;
do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'reservation_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end;$$;
