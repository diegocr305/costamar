-- Historial paginado de canjes: solo backend; misma autorización staff de canje.
create or replace function public.club_staff_redemption_history(
  p_date date default null,
  p_query text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with settings as (
    select greatest(1, least(coalesce(p_page, 1), 100000)) as page,
      greatest(1, least(coalesce(p_page_size, 20), 100)) as page_size
  ), filtered as (
    select red.id, red.created_at as "createdAt", cp.code as "couponCode",
      ca.name as "campaignName", ca.type as "campaignType",
      coalesce(nullif(btrim(m.full_name), ''), nullif(btrim(mp.full_name), ''), 'Socio') as "memberName",
      m.member_code as "memberCode",
      coalesce(nullif(btrim(sp.full_name), ''), su.email, 'Funcionario no disponible') as "staffName",
      red.consumption_ref as "consumptionRef", red.products
    from public.club_coupon_redemptions red
    join public.club_coupons cp on cp.id = red.coupon_id
    join public.club_campaigns ca on ca.id = cp.campaign_id
    left join public.club_members m on m.user_id = red.member_user_id
    left join public.profiles mp on mp.id = red.member_user_id
    left join public.profiles sp on sp.id = red.staff_user_id
    left join auth.users su on su.id = red.staff_user_id
    where (p_date is null or (
      red.created_at >= (p_date::timestamp at time zone 'America/Santiago')
      and red.created_at < ((p_date + 1)::timestamp at time zone 'America/Santiago')
    )) and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ',
      cp.code, ca.name, m.full_name, m.member_code, mp.full_name, sp.full_name, su.email, red.consumption_ref
    )), lower(btrim(p_query))) > 0)
  ), paged as (
    select * from filtered order by "createdAt" desc, id desc
      limit (select page_size from settings)
      offset (select (page - 1) * page_size from settings)
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(p) order by p."createdAt" desc, p.id desc) from paged p), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', (select page from settings), 'pageSize', (select page_size from settings));
$$;
revoke all on function public.club_staff_redemption_history(date, text, integer, integer) from public, anon, authenticated;
grant execute on function public.club_staff_redemption_history(date, text, integer, integer) to service_role;
create index if not exists idx_club_redemptions_created_at on public.club_coupon_redemptions(created_at desc, id desc);
