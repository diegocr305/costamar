-- ============================================================
-- Avisos por correo de reservas nuevas (casi en tiempo real).
--
-- Problema: el resumen de las 09:00 no sirve para una solicitud que llega a las 10:00 para comer
-- a las 16:00. Ahora cada solicitud web/Club dispara un aviso inmediato al encargado.
--
--  * Se avisa de 08:00 a 22:59 (hora de Chile). Fuera de ese horario NO se envía: la solicitud queda
--    pendiente y entra al resumen de las 09:00.
--  * Si una visita de HOY sigue pendiente 1 hora después, se envía UN recordatorio por reserva.
--  * Tope de 20 avisos "nueva solicitud" por hora (contra spam); el resto va en el resumen.
--  * Solo origen web/club. Las reservas que ingresa el equipo (source = admin) no avisan.
--  * El trigger nunca puede impedir que se cree una reserva: cualquier error se ignora con un WARNING.
-- ============================================================

create table if not exists public.reservation_alerts (
 id uuid primary key default gen_random_uuid(),
 reservation_id uuid not null references public.reservations(id) on delete cascade,
 kind text not null check (kind in ('new','reminder')),
 status text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
 detail text,
 created_at timestamptz not null default now(),
 sent_at timestamptz
);
comment on table public.reservation_alerts is 'Un aviso por reserva y tipo (new/reminder): garantiza idempotencia y permite el tope por hora.';
create unique index if not exists uq_reservation_alert_kind on public.reservation_alerts(reservation_id,kind);
create index if not exists idx_reservation_alerts_recent on public.reservation_alerts(kind,created_at);
alter table public.reservation_alerts enable row level security;
-- Sin políticas: solo backend (service_role).

-- Horario de avisos: 08:00 a 22:59 en America/Santiago.
create or replace function public.reservation_alert_in_hours(p_at timestamptz default now()) returns boolean
language sql stable set search_path='' as $$
 select extract(hour from (p_at at time zone 'America/Santiago')) between 8 and 22;
$$;

-- Llama a la Edge Function que envía el correo (URL y secreto desde Vault).
create or replace function public.reservation_alert_send(p_alert uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
 v_base text:=public.club_edge_setting('edge_base_url');
 v_key text:=public.club_edge_setting('edge_cron_secret');
begin
 if v_base is null or btrim(v_base)='' then return;end if;
 perform net.http_post(
  url:=rtrim(v_base,'/')||'/functions/v1/reservation-alert',
  body:=jsonb_build_object('alertId',p_alert),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||coalesce(v_key,'')));
end;$$;

-- Registra el aviso (idempotente) y lo envía si corresponde.
create or replace function public.reservation_alert_enqueue(p_reservation uuid,p_kind text default 'new',p_now timestamptz default now()) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_status text:='pending';v_detail text;
begin
 if not public.reservation_alert_in_hours(p_now) then
  v_status:='skipped';v_detail:='fuera de horario (08:00-23:00): va en el resumen de las 09:00';
 elsif p_kind='new' and (select count(*) from public.reservation_alerts where kind='new' and status in ('pending','sent') and created_at>p_now-interval '1 hour')>=20 then
  v_status:='skipped';v_detail:='tope de 20 avisos por hora: va en el resumen';
 end if;
 insert into public.reservation_alerts(reservation_id,kind,status,detail,created_at) values(p_reservation,p_kind,v_status,v_detail,p_now)
  on conflict (reservation_id,kind) do nothing returning id into v_id;
 if v_id is not null and v_status='pending' then perform public.reservation_alert_send(v_id);end if;
 return v_id;
end;$$;

create or replace function public.reservation_alert_on_insert() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.status='pending' and new.source in ('web','club') then
  begin
   perform public.reservation_alert_enqueue(new.id,'new');
  exception when others then
   raise warning 'reservation_alert_on_insert: %',sqlerrm; -- nunca bloquear la reserva
  end;
 end if;
 return new;
end;$$;
drop trigger if exists reservation_alert_on_insert on public.reservations;
create trigger reservation_alert_on_insert after insert on public.reservations
 for each row execute function public.reservation_alert_on_insert();

-- Recordatorio: visita de HOY, solicitud pendiente hace 1 hora o más. Un solo recordatorio por reserva.
create or replace function public.reservation_alert_reminders(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;
begin
 if not public.reservation_alert_in_hours(p_now) then return 0;end if;
 for r in select x.id from public.reservations x
  where x.status='pending' and x.source in ('web','club')
   and x.created_at<=p_now-interval '1 hour'
   and x.reserved_at>p_now
   and (x.reserved_at at time zone 'America/Santiago')::date=(p_now at time zone 'America/Santiago')::date
   and not exists(select 1 from public.reservation_alerts a where a.reservation_id=x.id and a.kind='reminder')
  order by x.reserved_at limit 10
 loop
  perform public.reservation_alert_enqueue(r.id,'reminder',p_now);
  n:=n+1;
 end loop;
 return n;
end;$$;

-- Datos para armar el correo.
create or replace function public.reservation_alert_payload(p_alert uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare a public.reservation_alerts;r public.reservations;
begin
 select * into a from public.reservation_alerts where id=p_alert;
 if not found then return null;end if;
 select * into r from public.reservations where id=a.reservation_id;
 return jsonb_build_object('alertId',a.id,'kind',a.kind,'alertStatus',a.status,
  'reservation',public.reservation_view(a.reservation_id,true),
  'isToday',(r.reserved_at at time zone 'America/Santiago')::date=(now() at time zone 'America/Santiago')::date,
  'minutesUntil',greatest(0,floor(extract(epoch from (r.reserved_at-now()))/60))::int,
  'pendingCount',(select count(*) from public.reservations x where x.status='pending' and x.reserved_at>=now()-interval '1 day'));
end;$$;

create or replace function public.reservation_alert_mark(p_alert uuid,p_status text,p_detail text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','failed','skipped') then raise exception 'ALERT_STATUS_INVALID';end if;
 update public.reservation_alerts set status=p_status,detail=left(p_detail,500),sent_at=case when p_status='sent' then now() else sent_at end
  where id=p_alert and status='pending';
end;$$;

revoke all on function public.reservation_alert_in_hours(timestamptz) from public,anon,authenticated;
revoke all on function public.reservation_alert_send(uuid) from public,anon,authenticated;
revoke all on function public.reservation_alert_enqueue(uuid,text,timestamptz) from public,anon,authenticated;
revoke all on function public.reservation_alert_on_insert() from public,anon,authenticated;
revoke all on function public.reservation_alert_reminders(timestamptz) from public,anon,authenticated;
revoke all on function public.reservation_alert_payload(uuid) from public,anon,authenticated;
revoke all on function public.reservation_alert_mark(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reservation_alert_in_hours(timestamptz) to service_role;
grant execute on function public.reservation_alert_send(uuid) to service_role;
grant execute on function public.reservation_alert_enqueue(uuid,text,timestamptz) to service_role;
grant execute on function public.reservation_alert_reminders(timestamptz) to service_role;
grant execute on function public.reservation_alert_payload(uuid) to service_role;
grant execute on function public.reservation_alert_mark(uuid,text,text) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('costamar-reservation-reminders','*/10 * * * *','select public.reservation_alert_reminders();');
