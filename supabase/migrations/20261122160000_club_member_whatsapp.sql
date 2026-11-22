-- ============================================================
-- Club Costa Mar: canal WhatsApp para los avisos de cumpleaños y bienvenida.
-- Para socios que NO autorizaron correo pero sí WhatsApp y tienen teléfono.
-- El envío es manual: el equipo abre wa.me desde el panel (celular con el número de Costa Mar)
-- y marca el aviso como enviado. Un aviso por cupón, tipo y canal.
-- ============================================================
alter table public.club_member_emails
  add column if not exists channel text not null default 'email';
alter table public.club_member_emails drop constraint if exists club_member_emails_channel_check;
alter table public.club_member_emails
  add constraint club_member_emails_channel_check check (channel in ('email','whatsapp'));
drop index if exists public.uq_club_member_emails_kind_coupon;
create unique index if not exists uq_club_member_emails_kind_coupon_channel
  on public.club_member_emails(kind, coupon_id, channel);

-- 1) Encola correos (consentimiento de email) y WhatsApp (solo si no hay consentimiento de email).
create or replace function public.club_prepare_member_emails(p_kind text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_month_start timestamptz := date_trunc('month', v_now at time zone 'America/Santiago') at time zone 'America/Santiago';
begin
  insert into public.club_member_emails (kind, coupon_id, channel)
  select x.kind, x.coupon_id, case when x.marketing_email then 'email' else 'whatsapp' end
    from (
      select case c.type when 'birthday' then 'birthday' else 'welcome' end as kind,
             q.id as coupon_id, p.marketing_email
        from public.club_coupons q
        join public.club_campaigns c on c.id = q.campaign_id and c.type in ('birthday','founders')
        join public.club_members m on m.user_id = q.user_id and m.status = 'active'
        join public.club_member_preferences p on p.user_id = q.user_id
       where q.status = 'issued'
         and (q.expires_at is null or q.expires_at > v_now)
         and (c.type = 'founders' or q.issued_at >= v_month_start)
         and (p.marketing_email
              or (p.marketing_whatsapp and nullif(btrim(m.phone), '') is not null))
    ) x
   where (p_kind is null or x.kind = p_kind)
     -- Un solo aviso por cupón y tipo, sin importar el canal.
     and not exists (select 1 from public.club_member_emails e2 where e2.kind = x.kind and e2.coupon_id = x.coupon_id)
  on conflict (kind, coupon_id, channel) do nothing;
end;
$$;
revoke all on function public.club_prepare_member_emails(text) from public, anon, authenticated;
grant execute on function public.club_prepare_member_emails(text) to service_role;

-- 2) Lote de correos pendientes (solo canal email).
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
   where e.status = 'pending' and e.channel = 'email'
     and q.status = 'issued'
     and (p_kind is null or e.kind = p_kind)
   order by e.created_at, e.id
   limit greatest(p_limit, 1);
$$;
revoke all on function public.club_pending_member_emails(text, integer) from public, anon, authenticated;
grant execute on function public.club_pending_member_emails(text, integer) to service_role;

-- 3) Cerrar un correo (solo canal email).
create or replace function public.club_mark_member_email(p_email_id uuid, p_status text, p_detail text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('sent','failed','skipped') then raise exception 'EMAIL_STATUS_INVALID'; end if;
  update public.club_member_emails
     set status = p_status, detail = left(p_detail, 500),
         sent_at = case when p_status = 'sent' then now() else sent_at end
   where id = p_email_id and status = 'pending' and channel = 'email';
end;
$$;
revoke all on function public.club_mark_member_email(uuid, text, text) from public, anon, authenticated;
grant execute on function public.club_mark_member_email(uuid, text, text) to service_role;

-- 4) Despacho del cron: solo llama a la Edge Function si hay correos pendientes.
create or replace function public.club_dispatch_member_emails(p_kind text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_base text := public.club_edge_setting('edge_base_url');
  v_key  text := public.club_edge_setting('edge_cron_secret');
begin
  perform public.club_prepare_member_emails(p_kind);
  if v_base is not null and btrim(v_base) <> ''
     and exists (select 1 from public.club_member_emails where status = 'pending' and kind = p_kind and channel = 'email') then
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

-- 5) Cola de WhatsApp para el panel (refresca la selección al abrirla).
create or replace function public.club_member_whatsapp_queue()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  perform public.club_prepare_member_emails(null);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', e.id, 'kind', e.kind, 'couponCode', q.code, 'expiresAt', q.expires_at,
             'memberName', m.full_name, 'memberCode', m.member_code, 'phone', m.phone,
             'campaignName', c.name, 'benefit', c.rules->>'benefit',
             'options', coalesce(c.rules->'options', '[]'::jsonb))
           order by q.expires_at nulls last, e.created_at)
      from public.club_member_emails e
      join public.club_coupons q on q.id = e.coupon_id
      join public.club_members m on m.user_id = q.user_id
      join public.club_campaigns c on c.id = q.campaign_id
     where e.channel = 'whatsapp' and e.status = 'pending' and q.status = 'issued'
       and (q.expires_at is null or q.expires_at > now())
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.club_member_whatsapp_queue() from public, anon, authenticated;
grant execute on function public.club_member_whatsapp_queue() to service_role;

-- 6) Marcar un WhatsApp como enviado por el equipo.
create or replace function public.club_mark_member_whatsapp(p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update public.club_member_emails set status = 'sent', sent_at = now(), detail = 'whatsapp:manual'
   where id = p_id and channel = 'whatsapp' and status = 'pending';
  return found;
end;
$$;
revoke all on function public.club_mark_member_whatsapp(uuid) from public, anon, authenticated;
grant execute on function public.club_mark_member_whatsapp(uuid) to service_role;

-- 7) Historial con canal y contacto según canal.
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
    select e.id, e.kind, e.channel, e.status, e.detail, e.created_at as "createdAt", e.sent_at as "sentAt",
           q.code as "couponCode", q.expires_at as "expiresAt", c.name as "campaignName",
           coalesce(m.full_name, 'Socio') as "memberName", m.member_code as "memberCode",
           case when e.channel = 'whatsapp' then m.phone else u.email::text end as "contact"
      from public.club_member_emails e
      join public.club_coupons q on q.id = e.coupon_id
      join public.club_campaigns c on c.id = q.campaign_id
      left join public.club_members m on m.user_id = q.user_id
      left join auth.users u on u.id = q.user_id
     where (p_kind is null or e.kind = p_kind)
       and (p_status is null or e.status = p_status)
       and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ',
              q.code, m.full_name, m.member_code, u.email, m.phone, c.name)), lower(btrim(p_query))) > 0)
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
