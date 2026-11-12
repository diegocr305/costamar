-- ============================================================
-- Reservas: orden de trabajo para el equipo + resumen diario por correo.
--
-- 1) reservation_list (staff): antes ordenaba SIEMPRE por fecha ascendente, así
--    que con "todas las fechas" aparecían primero las reservas más antiguas.
--    Ahora, sin fecha elegida, el orden es "lo que hay que hacer primero":
--      0  pendientes por confirmar (fecha futura o de hace menos de 1 día), la más próxima primero
--      1  confirmadas / en visita próximas, la más próxima primero
--      2  abiertas con fecha pasada (hay que cerrarlas: cancelar / no asistió), la más reciente primero
--      3  cerradas (finalizadas, canceladas, no asistió), la más reciente primero
--    Con una fecha elegida se mantiene el orden por hora (servicio del día).
--    El comportamiento para clientes (p_staff = false) no cambia.
--
-- 2) reservation_daily_digest: datos del resumen diario (hoy + por confirmar).
-- 3) reservation_dispatch_digest + cron: invoca la Edge Function "reservations-digest"
--    una vez al día a las 09:00 de America/Santiago.
-- ============================================================

create or replace function public.reservation_list(p_actor uuid,p_staff boolean,p_date date default null,p_status text default '',p_query text default '',p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;begin
 if p_staff and public.club_effective_role(p_actor) not in ('superadmin','admin','manager','cashier') then raise exception 'RESERVATION_FORBIDDEN';end if;
 if p_actor is null then raise exception 'RESERVATION_FORBIDDEN';end if;
 with filtered as (
  select r.id,r.reserved_at,
   case
    when p_staff and p_date is not null then 0
    when p_staff and r.status='pending' and r.reserved_at>=now()-interval '1 day' then 0
    when p_staff and r.status in ('confirmed','seated') and r.reserved_at>=now()-interval '1 day' then 1
    when p_staff and r.status in ('pending','confirmed','seated') then 2
    when p_staff then 3
    when r.status in ('pending','confirmed','seated') and r.reserved_at>=now()-interval '1 day' then 0
    else 1
   end as grp
  from public.reservations r
  where (p_staff or r.user_id=p_actor)
   and (p_date is null or (r.reserved_at >= p_date::timestamp at time zone 'America/Santiago' and r.reserved_at < (p_date+1)::timestamp at time zone 'America/Santiago'))
   and (p_status='' or r.status=p_status)
   and (p_query='' or position(lower(btrim(p_query)) in lower(r.customer_name||' '||r.customer_phone||' RES-'||lpad(r.folio::text,greatest(6,length(r.folio::text)),'0')))>0)
 ),
 ranked as (
  select id,row_number() over(order by grp,
    case when grp=0 or (p_staff and grp=1) then reserved_at end asc,
    case when not (grp=0 or (p_staff and grp=1)) then reserved_at end desc,
    id) as ord
  from filtered
 ),
 paged as (select id,ord from ranked order by ord limit 20 offset (greatest(1,p_page)-1)*20)
 select jsonb_build_object('total',(select count(*) from filtered),'page',greatest(1,p_page),'pageSize',20,
  'items',coalesce((select jsonb_agg(public.reservation_view(id,p_staff) order by ord) from paged),'[]'::jsonb)) into v_result;
 return v_result;
end;$$;

-- ------------------------------------------------------------
-- Datos del resumen diario para el dueño/equipo.
--   today   : reservas del día (no canceladas), por hora.
--   pending : solicitudes por confirmar con fecha futura (o de hace menos de 1 día), la más próxima primero.
--   stale   : cuántas reservas abiertas quedaron con fecha pasada sin cerrar.
-- ------------------------------------------------------------
create or replace function public.reservation_daily_digest(p_date date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_day date:=coalesce(p_date,(now() at time zone 'America/Santiago')::date);
begin
 return jsonb_build_object(
  'date',v_day,
  'today',coalesce((select jsonb_agg(public.reservation_view(t.id,true) order by t.reserved_at,t.id)
    from (select r.id,r.reserved_at from public.reservations r
      where r.reserved_at>=v_day::timestamp at time zone 'America/Santiago'
        and r.reserved_at<(v_day+1)::timestamp at time zone 'America/Santiago'
        and r.status in ('pending','confirmed','seated','completed','no_show')
      order by r.reserved_at,r.id limit 100) t),'[]'::jsonb),
  'pending',coalesce((select jsonb_agg(public.reservation_view(t.id,true) order by t.reserved_at,t.id)
    from (select r.id,r.reserved_at from public.reservations r
      where r.status='pending' and r.reserved_at>=now()-interval '1 day'
      order by r.reserved_at,r.id limit 50) t),'[]'::jsonb),
  'stale',(select count(*) from public.reservations r
      where r.status in ('pending','confirmed','seated') and r.reserved_at<now()-interval '1 day'));
end;$$;
revoke all on function public.reservation_daily_digest(date) from public,anon,authenticated;
grant execute on function public.reservation_daily_digest(date) to service_role;

-- ------------------------------------------------------------
-- Despacho: corre a las 12:00 y 13:00 UTC; solo una de las dos horas es las 09:00
-- en Chile (según horario de verano), así que el correo sale una vez al día.
-- Usa los mismos settings que los recordatorios de cupones:
--   app.settings.edge_base_url / app.settings.edge_cron_secret
-- Si no están definidos, no hace nada (no rompe).
-- ------------------------------------------------------------
create or replace function public.reservation_dispatch_digest() returns void
language plpgsql security definer set search_path='' as $$
declare
 v_base text:=current_setting('app.settings.edge_base_url',true);
 v_key text:=current_setting('app.settings.edge_cron_secret',true);
begin
 if extract(hour from (now() at time zone 'America/Santiago'))<>9 then return;end if;
 if v_base is null or btrim(v_base)='' then return;end if;
 perform net.http_post(
  url:=rtrim(v_base,'/')||'/functions/v1/reservations-digest',
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||coalesce(v_key,'')));
end;$$;
revoke all on function public.reservation_dispatch_digest() from public,anon,authenticated;
grant execute on function public.reservation_dispatch_digest() to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('costamar-reservations-digest','0 12,13 * * *','select public.reservation_dispatch_digest();');
