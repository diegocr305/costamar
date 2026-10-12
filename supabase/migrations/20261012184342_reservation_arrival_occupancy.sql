alter table public.reservations add column seated_at timestamptz,add column released_at timestamptz;
alter table public.reservation_pairs add column enabled boolean not null default true;
create or replace function public.reservation_view(p_id uuid,p_staff boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'reference','RES-'||lpad(r.folio::text,greatest(6,length(r.folio::text)),'0'),'customerName',r.customer_name,'customerPhone',r.customer_phone,'partySize',r.party_size,'reservedAt',r.reserved_at,'durationMinutes',r.duration_minutes,'bufferMinutes',r.buffer_minutes,'toleranceMinutes',r.tolerance_minutes,'status',r.status,'areaPreference',r.area_preference,'tableNumbers',r.table_numbers,'confirmedCapacity',r.confirmed_capacity,'seatedAt',r.seated_at,'releasedAt',r.released_at,'notes',r.notes,'source',r.source,'createdAt',r.created_at,'updatedAt',r.updated_at)
 || case when p_staff then jsonb_build_object('staffNote',r.staff_note,'events',coalesce((select jsonb_agg(jsonb_build_object('event',e.event,'actorName',coalesce(p.full_name,'Cliente'),'createdAt',e.created_at,'meta',e.meta) order by e.created_at,e.id) from public.reservation_events e left join public.profiles p on p.id=e.actor_id where e.reservation_id=r.id),'[]'::jsonb)) else '{}'::jsonb end
 from public.reservations r where r.id=p_id;
$$;
create or replace function public.reservation_config(p_staff boolean default false) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('durationSmall',s.duration_small,'durationLarge',s.duration_large,'bufferMinutes',s.buffer_minutes,'toleranceMinutes',s.tolerance_minutes,'advanceMinutes',s.advance_minutes,'hours',(select jsonb_agg(jsonb_build_object('day',day,'opens',to_char(opens,'HH24:MI'),'closes',to_char(closes,'HH24:MI'),'isOpen',is_open) order by day) from public.reservation_hours))
 || case when p_staff then jsonb_build_object('tables',(select jsonb_agg(jsonb_build_object('number',number,'area',area,'comfortable',comfortable,'maximum',maximum) order by number) from public.reservation_tables),'pairs',(select jsonb_agg(jsonb_build_object('a',a,'b',b,'capacity',capacity,'enabled',enabled) order by a,b) from public.reservation_pairs)) else '{}'::jsonb end
 from public.reservation_settings s;
$$;
create or replace function public.reservation_update(p_actor uuid,p_id uuid,p_patch jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_old public.reservations;v_new public.reservations;v_role text:=public.club_effective_role(p_actor);v_numbers integer[];v_seen integer[];v_number integer;v_changed boolean;v_max integer;v_capacity integer;v_pair_capacity integer;v_settings public.reservation_settings;v_start timestamptz;v_end timestamptz;
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
  if v_new.status='seated' and v_old.status='confirmed' then v_new.seated_at:=now();end if;
  v_start:=least(v_new.reserved_at,coalesce(v_new.seated_at,v_new.reserved_at));
  v_end:=greatest(v_new.reserved_at,coalesce(v_new.seated_at,v_new.reserved_at))+make_interval(mins=>v_new.duration_minutes+v_new.buffer_minutes);
  if cardinality(v_new.table_numbers)=0 then raise exception 'RESERVATION_TABLE_REQUIRED';end if;
  if cardinality(v_new.table_numbers)>2 and v_role='cashier' then raise exception 'RESERVATION_SPECIAL_GROUP';end if;
  if (select count(*) from public.reservation_tables where number=any(v_new.table_numbers))<>cardinality(v_new.table_numbers) or (select count(distinct area) from public.reservation_tables where number=any(v_new.table_numbers))<>1 then raise exception 'RESERVATION_TABLE_INVALID';end if;
  if cardinality(v_new.table_numbers)>1 then
   v_seen:=array[v_new.table_numbers[1]];
   loop
    v_changed:=false;
    foreach v_number in array v_new.table_numbers loop
     if not v_number=any(v_seen) and exists(select 1 from public.reservation_pairs where enabled and ((a=v_number and b=any(v_seen)) or (b=v_number and a=any(v_seen)))) then v_seen:=array_append(v_seen,v_number);v_changed:=true;end if;
    end loop;
    exit when not v_changed;
   end loop;
   if cardinality(v_seen)<>cardinality(v_new.table_numbers) then raise exception 'RESERVATION_PAIR_INVALID';end if;
  end if;
  select sum(maximum) into v_max from public.reservation_tables where number=any(v_new.table_numbers);
  if cardinality(v_new.table_numbers)=1 then v_capacity:=v_max;
  else
   select capacity into v_pair_capacity from public.reservation_pairs where enabled and a=v_new.table_numbers[1] and b=v_new.table_numbers[2] and cardinality(v_new.table_numbers)=2;
   v_capacity:=coalesce(v_pair_capacity,case when p_patch ? 'confirmedCapacity' then (p_patch->>'confirmedCapacity')::int when v_new.table_numbers=v_old.table_numbers then v_old.confirmed_capacity else null end);
   if v_capacity is null then raise exception 'RESERVATION_CAPACITY_REVIEW';end if;
  end if;
  if v_capacity>v_max or v_capacity<v_new.party_size then raise exception 'RESERVATION_CAPACITY';end if;
  v_new.confirmed_capacity:=v_capacity;
  if exists(select 1 from public.reservations r where r.id<>p_id and r.status in ('confirmed','seated') and r.table_numbers && v_new.table_numbers
   and least(r.reserved_at,coalesce(r.seated_at,r.reserved_at)) < v_end
   and v_start < greatest(r.reserved_at,coalesce(r.seated_at,r.reserved_at))+make_interval(mins=>r.duration_minutes+r.buffer_minutes)) then raise exception 'RESERVATION_OVERLAP';end if;
  if (v_new.status='seated' or (v_new.status='confirmed' and v_new.reserved_at<=now()+make_interval(mins=>v_new.tolerance_minutes))) and exists(select 1 from public.reservations r where r.id<>p_id and r.status='seated' and r.table_numbers && v_new.table_numbers) then raise exception 'RESERVATION_STILL_SEATED';end if;
 end if;
 update public.reservations set status=v_new.status,party_size=v_new.party_size,reserved_at=v_new.reserved_at,duration_minutes=v_new.duration_minutes,buffer_minutes=v_new.buffer_minutes,tolerance_minutes=v_new.tolerance_minutes,table_numbers=v_new.table_numbers,confirmed_capacity=v_new.confirmed_capacity,staff_note=v_new.staff_note,seated_at=v_new.seated_at,released_at=case when v_new.status='completed' then now() else released_at end,updated_at=now() where id=p_id;
 insert into public.reservation_events(reservation_id,actor_id,event,meta) values(p_id,p_actor,'staff_update',jsonb_build_object('previousStatus',v_old.status,'status',v_new.status,'tables',v_new.table_numbers,'previousTables',v_old.table_numbers,'partySize',v_new.party_size,'reservedAt',v_new.reserved_at,'confirmedCapacity',v_new.confirmed_capacity,'staffNote',v_new.staff_note));
 return public.reservation_view(p_id,true);
end;
$$;
create or replace function public.reservation_list(p_actor uuid,p_staff boolean,p_date date default null,p_status text default '',p_query text default '',p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;begin
 if p_staff and public.club_effective_role(p_actor) not in ('superadmin','admin','manager','cashier') then raise exception 'RESERVATION_FORBIDDEN';end if;
 if p_actor is null then raise exception 'RESERVATION_FORBIDDEN';end if;
 with filtered as (select r.id,r.reserved_at,r.status from public.reservations r where (p_staff or r.user_id=p_actor)
  and (p_date is null or (r.reserved_at >= p_date::timestamp at time zone 'America/Santiago' and r.reserved_at < (p_date+1)::timestamp at time zone 'America/Santiago'))
  and (p_status='' or r.status=p_status) and (p_query='' or position(lower(btrim(p_query)) in lower(r.customer_name||' '||r.customer_phone||' RES-'||lpad(r.folio::text,greatest(6,length(r.folio::text)),'0')))>0)),
 paged as (select *,row_number() over(order by case when not p_staff and status in ('pending','confirmed','seated') and reserved_at>=now()-interval '1 day' then 0 when not p_staff then 1 else 0 end,case when p_staff or (status in ('pending','confirmed','seated') and reserved_at>=now()-interval '1 day') then reserved_at end asc,case when not p_staff and not(status in ('pending','confirmed','seated') and reserved_at>=now()-interval '1 day') then reserved_at end desc,id) as ord from filtered order by case when not p_staff and status in ('pending','confirmed','seated') and reserved_at>=now()-interval '1 day' then 0 when not p_staff then 1 else 0 end,case when p_staff or (status in ('pending','confirmed','seated') and reserved_at>=now()-interval '1 day') then reserved_at end asc,case when not p_staff and not(status in ('pending','confirmed','seated') and reserved_at>=now()-interval '1 day') then reserved_at end desc,id limit 20 offset (greatest(1,p_page)-1)*20)
 select jsonb_build_object('total',(select count(*) from filtered),'page',greatest(1,p_page),'pageSize',20,'items',coalesce((select jsonb_agg(public.reservation_view(id,p_staff) order by ord) from paged),'[]'::jsonb)) into v_result;
 return v_result;
end;$$;
create or replace function public.reservation_save_config(p_actor uuid,p_config jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  update public.reservation_pairs set capacity=(v_item->>'capacity')::int,enabled=coalesce((v_item->>'enabled')::boolean,true) where a=(v_item->>'a')::int and b=(v_item->>'b')::int;
 end loop;
 insert into public.reservation_config_audit(actor_id,config) values(p_actor,p_config);
 return public.reservation_config(true);
end;$$;
