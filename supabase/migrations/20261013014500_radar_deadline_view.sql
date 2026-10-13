-- Fecha efectiva calculada para consultar cierres sin reescribir oportunidades.
-- Regla operativa: fechas civiles de las dos fuentes se interpretan en Santiago;
-- se distinguen de una confirmación manual y se rechazan horas DST ambiguas.
create function public.radar_chile_deadline(p_raw text) returns timestamptz
language plpgsql stable strict set search_path='' as $$
declare v_local timestamp; v_absolute timestamptz;
begin
 if p_raw !~ '^\d{4}-\d{2}-\d{2}[ T]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d{1,3})?)?$' then return null; end if;
 begin v_local:=replace(p_raw,'T',' ')::timestamp; exception when others then return null; end;
 if extract(year from v_local)<100 then return null; end if;
 v_absolute:=v_local at time zone 'America/Santiago';
 -- Un salto no tiene instante real; una repetición tiene dos instantes posibles.
 if v_absolute at time zone 'America/Santiago' <> v_local
  or (v_absolute-interval '1 hour') at time zone 'America/Santiago'=v_local
  or (v_absolute+interval '1 hour') at time zone 'America/Santiago'=v_local then return null; end if;
 return v_absolute;
end $$;
revoke all on function public.radar_chile_deadline(text) from public,anon,authenticated;
grant execute on function public.radar_chile_deadline(text) to service_role;

create view public.radar_opportunities_deadlines with(security_invoker=true) as
 select o.*,coalesce(o.verified_closes_at,o.closes_at,d.local_close) as effective_closes_at,
  case when o.verified_closes_at is not null then 'verified'
       when o.closes_at is not null then 'source_timezone'
       when d.local_close is not null then 'chile_local'
       else 'unavailable' end as deadline_basis
 from public.radar_opportunities o
 cross join lateral (select case when o.source in ('compra_agil','licitacion')
  then public.radar_chile_deadline(o.closes_raw) else null end as local_close) d;
revoke all on public.radar_opportunities_deadlines from public,anon,authenticated;
grant select on public.radar_opportunities_deadlines to service_role;
