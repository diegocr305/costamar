-- Vista general independiente del filtro gastronómico y clasificación conservadora.
alter table public.radar_opportunities add column match_kind text not null default 'matched'
 check(match_kind in ('matched','review','manual'));
alter table public.radar_opportunities add column match_reasons jsonb not null default '[]' check(jsonb_typeof(match_reasons)='array');
alter table public.radar_opportunities add column manual_selected boolean not null default false;
alter table public.radar_candidates add column priority integer not null default 2;
alter table public.radar_control add column general_next_request_at timestamptz;
create table public.radar_general_cache (
 cache_key text primary key, payload jsonb not null, checked_at timestamptz not null default now()
);
alter table public.radar_general_cache enable row level security;
revoke all on public.radar_general_cache from public,anon,authenticated;
grant all on public.radar_general_cache to service_role;

-- Una consulta manual no toma el lease del worker. Comparte la cuota y la pausa.
create function public.radar_general_consume() returns boolean
language plpgsql security definer set search_path='' as $$
declare v public.radar_control;
begin
 select * into v from public.radar_control where id=1 for update;
 if v.blocked_until>now() or v.general_next_request_at>now() then return false; end if;
 delete from public.radar_requests where created_at<now()-interval '25 hours';
 if (select count(*) from public.radar_requests where created_at>now()-interval '24 hours')>=9000 then return false; end if;
 insert into public.radar_requests default values;
 update public.radar_control set general_next_request_at=now()+interval '5 seconds' where id=1;
 return true;
end $$;

create function public.radar_general_pause(p_seconds integer,p_message text) returns void
language sql security definer set search_path='' as $$
 update public.radar_control set blocked_until=greatest(blocked_until,now()+make_interval(secs=>least(86400,greatest(1,p_seconds)))),last_error=left(p_message,500) where id=1;
$$;
create or replace function public.radar_release(p_owner uuid,p_error text default null,p_block_seconds integer default 0) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.radar_control set owner=null,lease_until=null,last_error=coalesce(p_error,case when blocked_until>now() then last_error else null end),
 last_success_at=case when p_error is null then now() else last_success_at end,
 blocked_until=case when p_block_seconds>0 then greatest(blocked_until,now()+make_interval(secs=>least(86400,p_block_seconds))) when blocked_until>now() then blocked_until else null end
 where id=1 and owner=p_owner;
end $$;

alter function public.radar_ingest(uuid,jsonb,jsonb,text) rename to radar_ingest_base;
create function public.radar_ingest(p_owner uuid,p_data jsonb,p_raw jsonb,p_fingerprint text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_input jsonb:=p_data;
begin
 -- Las coincidencias dudosas se guardan sin generar aviso automático de nueva oportunidad.
 if p_data->>'match_kind'='review' then v_input:=jsonb_set(v_input,'{profile_ids}','[]'); end if;
 v_id:=public.radar_ingest_base(p_owner,v_input,p_raw,p_fingerprint);
 update public.radar_opportunities set
  match_kind=coalesce(p_data->>'match_kind','matched'),
  match_reasons=coalesce(p_data->'match_reasons','[]'),
  profile_ids=array(select jsonb_array_elements_text(coalesce(p_data->'profile_ids','[]'))::uuid)
 where id=v_id;
 return v_id;
end $$;

create function public.radar_import_general(p_actor uuid,p_data jsonb,p_raw jsonb,p_fingerprint text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.radar_control; v_owner uuid; v_id uuid; v_temp boolean;
begin
 if public.club_effective_role(p_actor) not in ('superadmin','admin') then raise exception 'RADAR_FORBIDDEN'; end if;
 select * into v from public.radar_control where id=1 for update;
 v_temp := v.owner is null or v.lease_until is null or v.lease_until<=now();
 v_owner := case when v_temp then gen_random_uuid() else v.owner end;
 if v_temp then update public.radar_control set owner=v_owner,lease_until=now()+interval '1 minute' where id=1; end if;
 v_id:=public.radar_ingest(v_owner,p_data,p_raw,p_fingerprint);
 update public.radar_opportunities set manual_selected=true,tracked_by=coalesce(tracked_by,p_actor) where id=v_id;
 if v_temp then update public.radar_control set owner=v.owner,lease_until=v.lease_until where id=1; end if;
 return v_id;
end $$;

create or replace function public.radar_enqueue(p_owner uuid,p_candidates jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.radar_control where id=1 and owner=p_owner and lease_until>now() for update;
 if not found then raise exception 'RADAR_LEASE'; end if;
 insert into public.radar_candidates(source,code,revision,payload,priority)
 select x->>'source',x->>'code',x->>'revision',x->'payload',coalesce((x->>'priority')::integer,2) from jsonb_array_elements(p_candidates) x
 on conflict(source,code) do update set revision=excluded.revision,payload=excluded.payload,
 priority=greatest(radar_candidates.priority,excluded.priority),
 retry_at=case when radar_candidates.revision<>excluded.revision then now() else radar_candidates.retry_at end,
 failures=case when radar_candidates.revision<>excluded.revision then 0 else radar_candidates.failures end;
end $$;
create or replace function public.radar_pending_candidates(p_limit integer default 60) returns setof public.radar_candidates
language sql stable security definer set search_path='' as $$
 select c.* from public.radar_candidates c where c.retry_at<=now() and (
 c.revision is distinct from c.fetched_revision or
 (c.fetched_at<now()-interval '1 hour' and exists(select 1 from public.radar_opportunities o where o.source=c.source and o.code=c.code and (o.favorite or o.official_status='publicada' or o.stage in ('Postulada','Cotizando')))))
 order by c.priority desc,(c.revision is distinct from c.fetched_revision) desc,c.fetched_at nulls first,c.queued_at,c.code
 limit least(100,greatest(1,p_limit));
$$;

-- La nueva lógica debe volver a inspeccionar procesos abiertos con las variantes ampliadas.
update public.radar_profiles set updated_at=now();
update public.radar_control set queued=true where id=1;
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('radar_general_consume','radar_general_pause','radar_release','radar_ingest','radar_ingest_base','radar_import_general','radar_enqueue','radar_pending_candidates') loop
  execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
  execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
