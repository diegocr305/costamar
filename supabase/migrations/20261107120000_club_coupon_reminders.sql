-- ============================================================
-- Club Costa Mar: recordatorios de cupones por vencer.
-- Avisa a los socios 7 días antes de que expire un cupón emitido,
-- respetando el consentimiento de marketing (email / whatsapp).
--
-- Dos canales:
--   * email    -> envío automático (Edge Function "coupon-reminders" + Resend).
--   * whatsapp -> cola para que el equipo envíe con wa.me desde el panel admin.
--
-- Diseño coherente con el resto del Club:
--   * toda la lógica vive en RPCs security definer (service_role),
--   * fechas calculadas en America/Santiago,
--   * un solo aviso por cupón y canal (idempotente),
--   * nada destructivo.
-- ============================================================

-- Ventana de aviso: 7 días antes del vencimiento (configurable aquí).
-- Un cupón entra cuando le quedan 7 días o menos y aún no se le ha avisado.

create table if not exists public.club_coupon_reminders (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.club_coupons(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  -- 'pending'  : seleccionado, aún no entregado (cola de WhatsApp o email por enviar)
  -- 'sent'     : email entregado a Resend / WhatsApp marcado como enviado por el equipo
  -- 'skipped'  : no se pudo (sin dato de contacto, sin consentimiento al momento del envío)
  -- 'failed'   : el proveedor de email rechazó el envío
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
  detail text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
comment on table public.club_coupon_reminders is
  'Un registro por cupón y canal: evita duplicar el aviso de cupón por vencer.';

-- Un solo aviso por cupón y canal.
create unique index if not exists uq_coupon_reminder_channel
  on public.club_coupon_reminders(coupon_id, channel);
create index if not exists idx_coupon_reminders_status
  on public.club_coupon_reminders(status);

alter table public.club_coupon_reminders enable row level security;
-- Sin políticas => acceso solo backend (service_role). El socio no la consulta.

-- ------------------------------------------------------------
-- 1) Selección de cupones por vencer con el contacto del socio.
--    Crea (idempotente) los registros 'pending' que correspondan según
--    el consentimiento vigente, y devuelve lo que falta entregar.
--    * email: filas pending de cupones cuyo socio tiene marketing_email y correo.
--    * whatsapp: filas pending de cupones cuyo socio tiene marketing_whatsapp y teléfono.
-- ------------------------------------------------------------
create or replace function public.club_prepare_coupon_reminders(p_days integer default 7)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_limit timestamptz := v_now + make_interval(days => greatest(p_days, 0));
begin
  -- Serializa con cualquier otra preparación/sincronización de cupones.
  perform 1 from public.club_campaigns where slug = 'barco-cumpleanero' for update;

  -- Marca como vencidos los que ya expiraron (coherente con sync de cumpleaños).
  update public.club_coupons set status = 'expired'
    where status = 'issued' and expires_at is not null and expires_at <= v_now;

  -- Email: socio con consentimiento. (El email real se resuelve en la Edge Function
  -- desde auth.users; aquí solo exigimos el consentimiento.)
  insert into public.club_coupon_reminders (coupon_id, channel)
  select q.id, 'email'
    from public.club_coupons q
    join public.club_members m on m.user_id = q.user_id
    join public.club_member_preferences p on p.user_id = q.user_id
   where q.status = 'issued'
     and q.expires_at is not null
     and q.expires_at > v_now
     and q.expires_at <= v_limit
     and m.status = 'active'
     and p.marketing_email = true
  on conflict (coupon_id, channel) do nothing;

  -- WhatsApp: socio con consentimiento y teléfono.
  insert into public.club_coupon_reminders (coupon_id, channel)
  select q.id, 'whatsapp'
    from public.club_coupons q
    join public.club_members m on m.user_id = q.user_id
    join public.club_member_preferences p on p.user_id = q.user_id
   where q.status = 'issued'
     and q.expires_at is not null
     and q.expires_at > v_now
     and q.expires_at <= v_limit
     and m.status = 'active'
     and p.marketing_whatsapp = true
     and nullif(btrim(m.phone), '') is not null
  on conflict (coupon_id, channel) do nothing;
end;
$$;
revoke all on function public.club_prepare_coupon_reminders(integer) from public, anon, authenticated;
grant execute on function public.club_prepare_coupon_reminders(integer) to service_role;

-- ------------------------------------------------------------
-- 2) Lote de emails pendientes para la Edge Function.
--    Devuelve el contacto y los datos del cupón. El email NO está en
--    club_members, por eso la función también lo entrega desde auth.users.
-- ------------------------------------------------------------
create or replace function public.club_pending_email_reminders(p_limit integer default 200)
returns table (
  reminder_id uuid,
  coupon_id uuid,
  code text,
  expires_at timestamptz,
  full_name text,
  email text,
  campaign_name text,
  benefit text
)
language sql security definer set search_path = ''
as $$
  select r.id, q.id, q.code, q.expires_at,
         m.full_name,
         u.email::text,
         c.name,
         (c.rules->>'benefit')
    from public.club_coupon_reminders r
    join public.club_coupons q on q.id = r.coupon_id
    join public.club_members m on m.user_id = q.user_id
    join public.club_campaigns c on c.id = q.campaign_id
    join auth.users u on u.id = q.user_id
   where r.channel = 'email'
     and r.status = 'pending'
     and q.status = 'issued'
   order by q.expires_at asc
   limit greatest(p_limit, 1);
$$;
revoke all on function public.club_pending_email_reminders(integer) from public, anon, authenticated;
grant execute on function public.club_pending_email_reminders(integer) to service_role;

-- ------------------------------------------------------------
-- 3) Cerrar un recordatorio de email tras intentar enviarlo.
--    p_status: 'sent' | 'failed' | 'skipped'.
-- ------------------------------------------------------------
create or replace function public.club_mark_email_reminder(
  p_reminder_id uuid, p_status text, p_detail text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('sent','failed','skipped') then
    raise exception 'REMINDER_STATUS_INVALID';
  end if;
  update public.club_coupon_reminders
     set status = p_status,
         detail = left(p_detail, 500),
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_reminder_id and channel = 'email';
end;
$$;
revoke all on function public.club_mark_email_reminder(uuid, text, text) from public, anon, authenticated;
grant execute on function public.club_mark_email_reminder(uuid, text, text) to service_role;

-- ------------------------------------------------------------
-- 4) Cola de WhatsApp para el panel admin (equipo).
--    Lista los cupones por vencer cuyo aviso de WhatsApp sigue pendiente,
--    con el nombre y el teléfono para abrir wa.me. Primero prepara la
--    selección para que la cola esté siempre al día al abrir el panel.
-- ------------------------------------------------------------
create or replace function public.club_whatsapp_reminder_queue()
returns table (
  reminder_id uuid,
  coupon_id uuid,
  code text,
  expires_at timestamptz,
  full_name text,
  phone text,
  campaign_name text,
  benefit text
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.club_prepare_coupon_reminders(7);
  return query
    select r.id, q.id, q.code, q.expires_at,
           m.full_name, m.phone,
           c.name, (c.rules->>'benefit')
      from public.club_coupon_reminders r
      join public.club_coupons q on q.id = r.coupon_id
      join public.club_members m on m.user_id = q.user_id
      join public.club_campaigns c on c.id = q.campaign_id
     where r.channel = 'whatsapp'
       and r.status = 'pending'
       and q.status = 'issued'
     order by q.expires_at asc;
end;
$$;
revoke all on function public.club_whatsapp_reminder_queue() from public, anon, authenticated;
grant execute on function public.club_whatsapp_reminder_queue() to service_role;

-- ------------------------------------------------------------
-- 5) Marcar un aviso de WhatsApp como enviado por el equipo.
-- ------------------------------------------------------------
create or replace function public.club_mark_whatsapp_reminder(p_reminder_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.club_coupon_reminders
     set status = 'sent', sent_at = now()
   where id = p_reminder_id and channel = 'whatsapp' and status = 'pending';
end;
$$;
revoke all on function public.club_mark_whatsapp_reminder(uuid) from public, anon, authenticated;
grant execute on function public.club_mark_whatsapp_reminder(uuid) to service_role;

-- ============================================================
-- Cron diario (10:00 America/Santiago). pg_cron usa UTC, por eso el
-- horario se fija en UTC y la selección de fechas ocurre en zona Chile
-- dentro de las funciones. Chile sin horario de verano = UTC-4 => 14:00 UTC;
-- con horario de verano = UTC-3 => 13:00 UTC. Programamos ambas marcas y
-- cada ejecución es idempotente (un solo aviso por cupón/canal), de modo
-- que el cambio de horario no duplica ni omite avisos.
--
-- La invocación a la Edge Function "coupon-reminders" (envío real de email)
-- se hace con pg_net. La URL y la clave se leen desde app settings definidos
-- por el operador (ver docs/club-cupones-recordatorios.md). Si no están
-- configurados, el cron solo prepara la cola (WhatsApp sigue funcionando en
-- el panel) y el email queda pendiente hasta que se configure el secreto.
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.club_dispatch_coupon_reminders()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_base text := current_setting('app.settings.edge_base_url', true);
  v_key  text := current_setting('app.settings.edge_cron_secret', true);
begin
  -- Siempre deja la cola lista (WhatsApp + selección de email).
  perform public.club_prepare_coupon_reminders(7);

  -- Dispara el envío de emails solo si el operador configuró la Edge Function.
  if v_base is not null and btrim(v_base) <> '' then
    perform net.http_post(
      url := rtrim(v_base, '/') || '/functions/v1/coupon-reminders',
      body := '{}'::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(v_key, '')
      )
    );
  end if;
end;
$$;
revoke all on function public.club_dispatch_coupon_reminders() from public, anon, authenticated;
grant execute on function public.club_dispatch_coupon_reminders() to service_role;

-- Dos marcas diarias que cubren Chile con y sin horario de verano.
select cron.schedule('costamar-coupon-reminders-std', '0 14 * * *', 'select public.club_dispatch_coupon_reminders();');
select cron.schedule('costamar-coupon-reminders-dst', '0 13 * * *', 'select public.club_dispatch_coupon_reminders();');
