-- Radar aislado: tablas/RPC solo service_role; autorización de usuarios en API.
create table public.radar_profiles (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100),
 enabled boolean not null default true, regions integer[] not null default '{5}',
 keywords text[] not null, exclude_keywords text[] not null default '{}',
 preferred_communes text[] not null default '{}', min_budget numeric, max_budget numeric,
 include_unknown_budget boolean not null default true, include_licitaciones boolean not null default true,
 updated_at timestamptz not null default now(),
 check(cardinality(regions) between 1 and 16 and regions <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]),
 check(cardinality(keywords) between 1 and 50), check(min_budget is null or min_budget>=0),
 check(max_budget is null or max_budget>=coalesce(min_budget,0))
);
insert into public.radar_profiles(name,keywords,exclude_keywords,preferred_communes) values
 ('Gastronomía Costa Mar',array['alimentacion','colaciones','desayunos','almuerzos','catering','coffee','coffe','banqueteria','empanadas','bebidas','frutas','verduras','abarrotes','gastronomicos'],
 array['menaje','vajilla','desechable','nutricion enteral'],
 array['Quillota','La Calera','La Cruz','Limache','Olmué','Quilpué','Viña del Mar','Valparaíso']);

create table public.radar_opportunities (
 id uuid primary key default gen_random_uuid(), source text not null check(source in ('compra_agil','licitacion')),
 code text not null, name text not null, description text not null default '', official_status text not null,
 buyer text not null default '', buyer_rut text not null default '', region integer, buyer_commune text not null default '',
 delivery text not null default '', delivery_days integer, budget numeric, currency text not null default '', budget_type text not null default '',
 call_number integer, closes_raw text not null default '', closes_at timestamptz, verified_closes_at timestamptz,
 published_raw text not null default '', source_changed_raw text not null default '',
 checked_at timestamptz not null default now(), detail_checked_at timestamptz, created_at timestamptz not null default now(),
 items jsonb not null default '[]', documents jsonb not null default '[]', profile_ids uuid[] not null default '{}',
 stage text not null default 'Nueva' check(stage in ('Nueva','Analizando','Interesante','Cotizando','Postulada','Adjudicada','No adjudicada','Descartada')),
 favorite boolean not null default false, notes text not null default '' check(length(notes)<=5000),
 tracking_updated_at timestamptz, tracked_by uuid references public.profiles(id),
 fingerprint text not null, raw_payload jsonb not null, search_text text not null default '', delivery_search text not null default '',
 unique(source,code), check(jsonb_typeof(items)='array'), check(jsonb_typeof(documents)='array')
);
create index radar_opportunities_recent on public.radar_opportunities(checked_at desc);
create index radar_opportunities_profiles on public.radar_opportunities using gin(profile_ids);
create index radar_opportunities_close on public.radar_opportunities((coalesce(verified_closes_at,closes_at)));
create table public.radar_versions (
 id bigint generated always as identity primary key,
 opportunity_id uuid not null references public.radar_opportunities(id) on delete cascade,
 fingerprint text not null, payload jsonb not null, created_at timestamptz not null default now()
);
create index radar_versions_opportunity on public.radar_versions(opportunity_id,created_at desc);
create table public.radar_alerts (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.radar_opportunities(id) on delete cascade,
 event_key text not null unique, kind text not null check(kind in ('new','changed','closing')),
 title text not null, message text not null, created_at timestamptz not null default now(), read_at timestamptz,
 read_by uuid references public.profiles(id), email_state text not null default 'pending' check(email_state in ('pending','sending','sent','failed','review','skipped')),
 email_attempts integer not null default 0, email_first_attempt_at timestamptz, email_next_at timestamptz not null default now(),
 email_payload jsonb, email_provider_id text, email_error text
);
create table public.radar_cursors (
 scope text primary key, mode text not null default 'bootstrap', next_page integer not null default 1 check(next_page>0),
 window_start timestamptz, window_end timestamptz, completed_at timestamptz, bootstrapped_at timestamptz, profile_revision text, updated_at timestamptz not null default now()
);
create table public.radar_control (
 id integer primary key check(id=1), owner uuid, lease_until timestamptz,
 queued boolean not null default true, last_request_at timestamptz,
 worker_seen_at timestamptz, last_attempt_at timestamptz, last_success_at timestamptz, last_error text,
 blocked_until timestamptz
);
insert into public.radar_control(id) values(1);
create table public.radar_requests (id bigint generated always as identity primary key, created_at timestamptz not null default now());
create index radar_requests_time on public.radar_requests(created_at);
create table public.radar_uploads (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.radar_opportunities(id) on delete cascade,
 name text not null, path text not null unique, content_type text not null, size integer not null check(size between 1 and 10485760),
 uploaded_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.radar_candidates (
 source text not null, code text not null, revision text not null, fetched_revision text,
 payload jsonb not null, queued_at timestamptz not null default now(), fetched_at timestamptz,
 retry_at timestamptz not null default now(), failures integer not null default 0,
 primary key(source,code)
);

create function public.radar_claim(p_owner uuid,p_interval integer default 900) returns boolean
language plpgsql security definer set search_path='' as $$
declare v public.radar_control;
begin
 select * into v from public.radar_control where id=1 for update;
 update public.radar_control set worker_seen_at=now() where id=1;
 if v.lease_until>now() or v.blocked_until>now() then return false; end if;
 if not v.queued and v.last_attempt_at>now()-make_interval(secs=>greatest(60,p_interval)) then return false; end if;
 update public.radar_control set owner=p_owner,lease_until=now()+interval '10 minutes',queued=false,last_attempt_at=now() where id=1;
 return true;
end; $$;
create function public.radar_consume_request(p_owner uuid,p_limit integer default 9000) returns boolean
language plpgsql security definer set search_path='' as $$
declare v public.radar_control;
begin
 select * into v from public.radar_control where id=1 for update;
 if v.owner is distinct from p_owner or v.lease_until<=now() then raise exception 'RADAR_LEASE'; end if;
 if v.blocked_until>now() then return false; end if;
 delete from public.radar_requests where created_at<now()-interval '25 hours';
 if (select count(*) from public.radar_requests where created_at>now()-interval '24 hours') >= least(9000,greatest(1,p_limit)) then return false; end if;
 insert into public.radar_requests default values;
 update public.radar_control set lease_until=now()+interval '10 minutes',worker_seen_at=now() where id=1;
 return true;
end; $$;
create function public.radar_release(p_owner uuid,p_error text default null,p_block_seconds integer default 0) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.radar_control set owner=null,lease_until=null,last_error=left(p_error,500),
 last_success_at=case when p_error is null then now() else last_success_at end,
 blocked_until=case when p_block_seconds>0 then now()+make_interval(secs=>least(86400,p_block_seconds)) else null end
 where id=1 and owner=p_owner;
end; $$;
create function public.radar_queue() returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.radar_control set queued=true,last_request_at=now() where id=1
 and (last_request_at is null or last_request_at<now()-interval '1 minute');
 return found;
end; $$;
create function public.radar_enqueue(p_owner uuid,p_candidates jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.radar_control where id=1 and owner=p_owner and lease_until>now() for update;
 if not found then raise exception 'RADAR_LEASE'; end if;
 insert into public.radar_candidates(source,code,revision,payload)
 select x->>'source',x->>'code',x->>'revision',x->'payload' from jsonb_array_elements(p_candidates) x
 on conflict(source,code) do update set revision=excluded.revision,payload=excluded.payload,
 retry_at=case when radar_candidates.revision<>excluded.revision then now() else radar_candidates.retry_at end,
 failures=case when radar_candidates.revision<>excluded.revision then 0 else radar_candidates.failures end;
end; $$;
create function public.radar_pending_candidates(p_limit integer default 60) returns setof public.radar_candidates
language sql stable security definer set search_path='' as $$
 select c.* from public.radar_candidates c where c.retry_at<=now() and (
 c.revision is distinct from c.fetched_revision or
 (c.fetched_at<now()-interval '1 hour' and exists(select 1 from public.radar_opportunities o where o.source=c.source and o.code=c.code and (o.favorite or o.official_status='publicada' or o.stage in ('Postulada','Cotizando')))))
 order by (c.revision is distinct from c.fetched_revision) desc,c.fetched_at nulls first,c.queued_at
 limit least(100,greatest(1,p_limit));
$$;
create function public.radar_ingest(p_owner uuid,p_data jsonb,p_raw jsonb,p_fingerprint text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_old public.radar_opportunities; v_id uuid; v_changed boolean; v_kind text; v_title text;
begin
 perform 1 from public.radar_control where id=1 and owner=p_owner and lease_until>now() for update;
 if not found then raise exception 'RADAR_LEASE'; end if;
 select * into v_old from public.radar_opportunities where source=p_data->>'source' and code=p_data->>'code' for update;
 v_changed := v_old.id is null or v_old.fingerprint<>p_fingerprint;
 insert into public.radar_opportunities(source,code,name,description,official_status,buyer,buyer_rut,region,buyer_commune,delivery,delivery_days,
 budget,currency,budget_type,call_number,closes_raw,closes_at,published_raw,source_changed_raw,detail_checked_at,items,documents,profile_ids,fingerprint,raw_payload)
 values(p_data->>'source',p_data->>'code',p_data->>'name',coalesce(p_data->>'description',''),p_data->>'official_status',coalesce(p_data->>'buyer',''),coalesce(p_data->>'buyer_rut',''),
 (p_data->>'region')::integer,coalesce(p_data->>'buyer_commune',''),coalesce(p_data->>'delivery',''),(p_data->>'delivery_days')::integer,
 (p_data->>'budget')::numeric,coalesce(p_data->>'currency',''),coalesce(p_data->>'budget_type',''),(p_data->>'call_number')::integer,
 coalesce(p_data->>'closes_raw',''),(p_data->>'closes_at')::timestamptz,coalesce(p_data->>'published_raw',''),coalesce(p_data->>'source_changed_raw',''),now(),
 coalesce(p_data->'items','[]'),coalesce(p_data->'documents','[]'),array(select jsonb_array_elements_text(coalesce(p_data->'profile_ids','[]'))::uuid),p_fingerprint,p_raw)
 on conflict(source,code) do update set name=excluded.name,description=excluded.description,official_status=excluded.official_status,
 buyer=excluded.buyer,buyer_rut=excluded.buyer_rut,region=excluded.region,buyer_commune=excluded.buyer_commune,delivery=excluded.delivery,delivery_days=excluded.delivery_days,
 budget=excluded.budget,currency=excluded.currency,budget_type=excluded.budget_type,call_number=excluded.call_number,
 closes_at=excluded.closes_at,closes_raw=excluded.closes_raw,
 verified_closes_at=case when radar_opportunities.closes_raw=excluded.closes_raw then radar_opportunities.verified_closes_at else null end,
 published_raw=excluded.published_raw,source_changed_raw=excluded.source_changed_raw,checked_at=now(),detail_checked_at=now(),items=excluded.items,documents=excluded.documents,
 profile_ids=excluded.profile_ids,fingerprint=excluded.fingerprint,raw_payload=excluded.raw_payload
 returning id into v_id;
 update public.radar_opportunities set search_text=translate(lower(name||' '||code||' '||buyer),'áéíóúüñ','aeiouun'),
 delivery_search=translate(lower(delivery||' '||buyer_commune),'áéíóúüñ','aeiouun') where id=v_id;
 if v_changed then
  insert into public.radar_versions(opportunity_id,fingerprint,payload) values(v_id,p_fingerprint,p_raw);
  v_kind := case when v_old.id is null then 'new' else 'changed' end;
  v_title := case when v_old.id is null then 'Nueva oportunidad' else 'Cambió una oportunidad' end;
  if cardinality(array(select jsonb_array_elements_text(coalesce(p_data->'profile_ids','[]'))))>0 or coalesce(v_old.favorite,false) then
   insert into public.radar_alerts(opportunity_id,event_key,kind,title,message)
   values(v_id,v_id::text||':'||(select id::text from public.radar_versions where opportunity_id=v_id order by id desc limit 1),v_kind,v_title,(p_data->>'code')||' · '||(p_data->>'name'));
  end if;
 end if;
 return v_id;
end; $$;

-- Cierres solo con fecha confirmada. La fecha original queda disponible en la ficha.
create function public.radar_closing_alerts(p_owner uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
 perform 1 from public.radar_control where id=1 and owner=p_owner and lease_until>now() for update;
 if not found then raise exception 'RADAR_LEASE'; end if;
 insert into public.radar_alerts(opportunity_id,event_key,kind,title,message)
 select id,id::text||':closing:'||coalesce(verified_closes_at,closes_at)::text,'closing','Cierre próximo',code||' · '||name
 from public.radar_opportunities where official_status='publicada' and stage<>'Descartada'
 and (favorite or cardinality(profile_ids)>0) and checked_at>now()-interval '2 hours'
 and coalesce(verified_closes_at,closes_at)>now() and coalesce(verified_closes_at,closes_at)<=now()+interval '24 hours'
 on conflict(event_key) do nothing;
 get diagnostics v_count=row_count; return v_count;
end; $$;

do $$ declare t text; f record; begin
 foreach t in array array['radar_profiles','radar_opportunities','radar_versions','radar_alerts','radar_cursors','radar_control','radar_requests','radar_uploads','radar_candidates'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'radar\_%' escape '\' loop
  execute 'revoke all on function '||f.signature||' from public,anon,authenticated';
  execute 'grant execute on function '||f.signature||' to service_role';
 end loop;
end $$;
grant usage,select on sequence public.radar_versions_id_seq,public.radar_requests_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('radar-documents','radar-documents',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Cierra este bucket incluso si existen políticas permisivas para otros archivos.
create policy radar_documents_backend_only on storage.objects as restrictive
 for all to anon,authenticated using(bucket_id<>'radar-documents') with check(bucket_id<>'radar-documents');
