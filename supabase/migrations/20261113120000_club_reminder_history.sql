-- Historial de recordatorios de cupones por vencer, para el panel admin.
-- Solo lectura sobre club_coupon_reminders. Ejecutable únicamente por backend.
create or replace function public.club_admin_reminder_history(
  p_channel text default null,
  p_status text default null,
  p_query text default null,
  p_page integer default 1,
  p_page_size integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  with settings as (
    select greatest(1, least(coalesce(p_page, 1), 100000)) as page,
           greatest(1, least(coalesce(p_page_size, 20), 100)) as page_size
  ), rows_all as (
    select r.id, r.channel, r.status, r.detail,
           r.created_at as "createdAt", r.sent_at as "sentAt",
           q.code as "couponCode", q.expires_at as "expiresAt",
           c.name as "campaignName",
           coalesce(m.full_name, 'Socio') as "memberName",
           m.member_code as "memberCode",
           case when r.channel = 'email' then u.email::text else m.phone end as "contact"
      from public.club_coupon_reminders r
      join public.club_coupons q on q.id = r.coupon_id
      join public.club_campaigns c on c.id = q.campaign_id
      left join public.club_members m on m.user_id = q.user_id
      left join auth.users u on u.id = q.user_id
     where (p_channel is null or r.channel = p_channel)
       and (p_status is null or r.status = p_status)
       and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ',
              q.code, m.full_name, m.member_code, u.email, m.phone, c.name)), lower(btrim(p_query))) > 0)
  ), paged as (
    select * from rows_all
     order by coalesce("sentAt", "createdAt") desc, id desc
     limit (select page_size from settings) offset (select (page - 1) * page_size from settings)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(p) order by coalesce(p."sentAt", p."createdAt") desc, p.id desc) from paged p), '[]'::jsonb),
    'total', (select count(*) from rows_all),
    'page', (select page from settings),
    'pageSize', (select page_size from settings),
    'summary', (select jsonb_build_object(
        'pending', count(*) filter (where status = 'pending'),
        'sent', count(*) filter (where status = 'sent'),
        'failed', count(*) filter (where status = 'failed'),
        'skipped', count(*) filter (where status = 'skipped'))
      from public.club_coupon_reminders)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.club_admin_reminder_history(text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.club_admin_reminder_history(text, text, text, integer, integer) to service_role;
