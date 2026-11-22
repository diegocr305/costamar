-- ============================================================
-- Club Costa Mar: correos automáticos a socios con su cupón.
--   * birthday : saludo de cumpleaños con el cupón del mes (el día 1 salen todos los del mes;
--                los socios que se inscriben a mitad de mes lo reciben en la corrida diaria siguiente).
--   * welcome  : bienvenida al Club con el regalo de fundadores.
-- Un correo por cupón y tipo (idempotente). Respeta marketing_email.
-- La entrega la hace la Edge Function "club-emails" (Resend).
-- ============================================================
create table if not exists public.club_member_emails (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('birthday','welcome')),
  coupon_id uuid not null references public.club_coupons(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed')),
  detail text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
comment on table public.club_member_emails is
  'Un registro por cupón y tipo de correo (cumpleaños / bienvenida): evita duplicar envíos.';
create unique index if not exists uq_club_member_emails_kind_coupon on public.club_member_emails(kind, coupon_id);
create index if not exists idx_club_member_emails_status on public.club_member_emails(status);
alter table public.club_member_emails enable row level security;
-- Sin políticas: solo backend (service_role).

-- 1) Encola los correos que correspondan (idempotente).
create or replace function public.club_prepare_member_emails(p_kind text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_month_start timestamptz := date_trunc('month', v_now at time zone 'America/Santiago') at time zone 'America/Santiago';
begin
  if p_kind is null or p_kind = 'birthday' then
    insert into public.club_member_emails (kind, coupon_id)
    select 'birthday', q.id
      from public.club_coupons q
      join public.club_campaigns c on c.id = q.campaign_id and c.type = 'birthday'
      join public.club_members m on m.user_id = q.user_id and m.status = 'active'
      join public.club_member_preferences p on p.user_id = q.user_id and p.marketing_email
     where q.status = 'issued'
       and q.expires_at > v_now
       and q.issued_at >= v_month_start
    on conflict (kind, coupon_id) do nothing;
  end if;
  if p_kind is null or p_kind = 'welcome' then
    insert into public.club_member_emails (kind, coupon_id)
    select 'welcome', q.id
      from public.club_coupons q
      join public.club_campaigns c on c.id = q.campaign_id and c.type = 'founders'
      join public.club_members m on m.user_id = q.user_id and m.status = 'active'
      join public.club_member_preferences p on p.user_id = q.user_id and p.marketing_email
     where q.status = 'issued'
       and (q.expires_at is null or q.expires_at > v_now)
    on conflict (kind, coupon_id) do nothing;
  end if;
end;
$$;
revoke all on function public.club_prepare_member_emails(text) from public, anon, authenticated;
grant execute on function public.club_prepare_member_emails(text) to service_role;

-- 2) Lote pendiente para la Edge Function (incluye el correo desde auth.users).
create or replace function public.club_pending_member_emails(p_kind text default null, p_limit integer default 100)
returns table (
  email_id uuid, kind text, code text, expires_at timestamptz,
  full_name text, member_code text, email text,
  campaign_name text, benefit text, options jsonb
)
language sql security definer set search_path = ''
as $$
  select e.id, e.kind, q.code, q.expires_at,
         m.full_name, m.member_code, u.email::text,
         c.name, (c.rules->>'benefit'), coalesce(c.rules->'options', '[]'::jsonb)
    from public.club_member_emails e
    join public.club_coupons q on q.id = e.coupon_id
    join public.club_members m on m.user_id = q.user_id
    join public.club_campaigns c on c.id = q.campaign_id
    join auth.users u on u.id = q.user_id
   where e.status = 'pending'
     and q.status = 'issued'
     and (p_kind is null or e.kind = p_kind)
   order by e.created_at, e.id
   limit greatest(p_limit, 1);
$$;
revoke all on function public.club_pending_member_emails(text, integer) from public, anon, authenticated;
grant execute on function public.club_pending_member_emails(text, integer) to service_role;

-- 3) Cerrar un correo tras intentar enviarlo.
create or replace function public.club_mark_member_email(p_email_id uuid, p_status text, p_detail text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('sent','failed','skipped') then raise exception 'EMAIL_STATUS_INVALID'; end if;
  update public.club_member_emails
     set status = p_status, detail = left(p_detail, 500),
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_email_id and status = 'pending';
end;
$$;
revoke all on function public.club_mark_member_email(uuid, text, text) from public, anon, authenticated;
grant execute on function public.club_mark_member_email(uuid, text, text) to service_role;

-- 4) Despacho desde cron: prepara la cola y llama a la Edge Function.
create or replace function public.club_dispatch_member_emails(p_kind text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_base text := public.club_edge_setting('edge_base_url');
  v_key  text := public.club_edge_setting('edge_cron_secret');
begin
  perform public.club_prepare_member_emails(p_kind);
  if v_base is not null and btrim(v_base) <> ''
     and exists (select 1 from public.club_member_emails where status = 'pending' and kind = p_kind) then
    perform net.http_post(
      url := rtrim(v_base, '/') || '/functions/v1/club-emails',
      body := jsonb_build_object('kind', p_kind),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')),
      timeout_milliseconds := 60000);
  end if;
end;
$$;
revoke all on function public.club_dispatch_member_emails(text) from public, anon, authenticated;
grant execute on function public.club_dispatch_member_emails(text) to service_role;

-- 5) Historial para el panel admin.
create or replace function public.club_admin_member_email_history(
  p_kind text default null, p_status text default null, p_query text default null,
  p_page integer default 1, p_page_size integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  with settings as (
    select greatest(1, least(coalesce(p_page, 1), 100000)) as page,
           greatest(1, least(coalesce(p_page_size, 20), 100)) as page_size
  ), rows_all as (
    select e.id, e.kind, e.status, e.detail, e.created_at as "createdAt", e.sent_at as "sentAt",
           q.code as "couponCode", q.expires_at as "expiresAt", c.name as "campaignName",
           coalesce(m.full_name, 'Socio') as "memberName", m.member_code as "memberCode", u.email::text as "contact"
      from public.club_member_emails e
      join public.club_coupons q on q.id = e.coupon_id
      join public.club_campaigns c on c.id = q.campaign_id
      left join public.club_members m on m.user_id = q.user_id
      left join auth.users u on u.id = q.user_id
     where (p_kind is null or e.kind = p_kind)
       and (p_status is null or e.status = p_status)
       and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ',
              q.code, m.full_name, m.member_code, u.email, c.name)), lower(btrim(p_query))) > 0)
  ), paged as (
    select * from rows_all order by coalesce("sentAt", "createdAt") desc, id desc
     limit (select page_size from settings) offset (select (page - 1) * page_size from settings)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by coalesce(p."sentAt", p."createdAt") desc, p.id desc) from paged p), '[]'::jsonb),
    'total', (select count(*) from rows_all),
    'page', (select page from settings), 'pageSize', (select page_size from settings),
    'summary', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'), 'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'), 'skipped', count(*) filter (where status = 'skipped'))
      from public.club_member_emails)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.club_admin_member_email_history(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.club_admin_member_email_history(text, text, text, integer, integer) to service_role;

-- Cron (UTC). Cumpleaños: diario 10:00 Chile (13 y 14 UTC cubren horario de verano/invierno);
-- el día 1 salen todos los cupones del mes. Bienvenida: cada 15 minutos entre 09:00 y 22:00 Chile aprox.
select cron.schedule('costamar-birthday-emails-dst', '5 13 * * *', $c$select public.club_dispatch_member_emails('birthday');$c$);
select cron.schedule('costamar-birthday-emails-std', '5 14 * * *', $c$select public.club_dispatch_member_emails('birthday');$c$);
select cron.schedule('costamar-welcome-emails', '*/15 0-2,12-23 * * *', $c$select public.club_dispatch_member_emails('welcome');$c$);
