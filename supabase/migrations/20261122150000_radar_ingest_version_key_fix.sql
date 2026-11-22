-- Radar: corrige la clave del aviso de "nueva / cambió una oportunidad".
-- Antes la versión se buscaba con "select id::text ... order by id desc": el ORDER BY usaba la
-- columna de salida (texto), así que '985' quedaba antes que '2843'. Desde que los ids de versión
-- llegaron a 4 dígitos, cada cambio de una oportunidad con versiones antiguas repetía una clave
-- ya usada (23505 en radar_alerts.event_key), la sincronización se abortaba y se reintentaba cada
-- hora consumiendo consultas a Mercado Público sin avanzar.
-- Ahora se usa el id devuelto por el INSERT de la versión.
create or replace function public.radar_ingest_base(p_owner uuid, p_data jsonb, p_raw jsonb, p_fingerprint text)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare v_old public.radar_opportunities; v_id uuid; v_changed boolean; v_kind text; v_title text; v_version bigint;
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
  insert into public.radar_versions(opportunity_id,fingerprint,payload) values(v_id,p_fingerprint,p_raw)
   returning id into v_version;
  v_kind := case when v_old.id is null then 'new' else 'changed' end;
  v_title := case when v_old.id is null then 'Nueva oportunidad' else 'Cambió una oportunidad' end;
  if cardinality(array(select jsonb_array_elements_text(coalesce(p_data->'profile_ids','[]'))))>0 or coalesce(v_old.favorite,false) then
   insert into public.radar_alerts(opportunity_id,event_key,kind,title,message)
   values(v_id,v_id::text||':'||v_version::text,v_kind,v_title,(p_data->>'code')||' · '||(p_data->>'name'))
   on conflict (event_key) do nothing;
  end if;
 end if;
 return v_id;
end; $function$;
revoke all on function public.radar_ingest_base(uuid, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.radar_ingest_base(uuid, jsonb, jsonb, text) to service_role;
