-- Orden de atención: mesa, referencias opcionales y folio único.
-- Se conserva consumption_ref histórico; no se infieren mesas de texto libre.
alter table public.club_coupon_redemptions
  add column folio_no bigint generated always as identity,
  add column table_label text check (table_label is null or char_length(btrim(table_label)) between 1 and 40),
  add column order_ref text check (order_ref is null or char_length(order_ref) <= 80),
  add column note text check (note is null or char_length(note) <= 300);
create unique index uq_club_redemption_folio on public.club_coupon_redemptions(folio_no);
create index idx_club_redemptions_table_date on public.club_coupon_redemptions(lower(table_label),created_at desc);
comment on column public.club_coupon_redemptions.folio_no is 'Folio único asignado automáticamente; puede tener saltos por transacciones revertidas.';

create or replace function public.redeem_coupon_at_table(
  p_code text,p_staff_user_id uuid,p_table_label text,
  p_products jsonb default '[]'::jsonb,p_order_ref text default null,p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_red public.club_coupon_redemptions; v_table text := nullif(btrim(p_table_label),'');
begin
  if v_table is null then raise exception 'TABLE_REQUIRED'; end if;
  if v_table ~ '^[0-9]+$' then v_table := 'Mesa ' || v_table; end if;
  if char_length(v_table)>40 or char_length(coalesce(p_order_ref,''))>80 or char_length(coalesce(p_note,''))>300 then raise exception 'REDEMPTION_DETAILS_INVALID'; end if;
  v_red := public.redeem_coupon(p_code,p_staff_user_id,p_products,v_table);
  update public.club_coupon_redemptions set table_label=v_table,order_ref=nullif(btrim(p_order_ref),''),note=nullif(btrim(p_note),'')
    where id=v_red.id returning * into v_red;
  return jsonb_build_object('id',v_red.id,'folio','CAN-'||lpad(v_red.folio_no::text,greatest(6,length(v_red.folio_no::text)),'0'),
    'tableLabel',v_red.table_label,'orderRef',v_red.order_ref,'note',v_red.note,'createdAt',v_red.created_at,'products',v_red.products);
end;
$$;
revoke all on function public.redeem_coupon_at_table(text,uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.redeem_coupon_at_table(text,uuid,text,jsonb,text,text) to service_role;
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
    select red.id, 'CAN-' || lpad(red.folio_no::text, greatest(6,length(red.folio_no::text)),'0') as folio, red.table_label as "tableLabel", red.order_ref as "orderRef", red.note, red.created_at as "createdAt", cp.code as "couponCode",
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
      cp.code, ca.name, m.full_name, m.member_code, mp.full_name, sp.full_name, su.email, red.consumption_ref, red.table_label, red.order_ref, red.note, 'CAN-' || lpad(red.folio_no::text,greatest(6,length(red.folio_no::text)),'0')
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

create or replace function public.club_staff_redemption_history_filtered(
  p_date date default null,
  p_query text default null,
  p_page integer default 1,
  p_page_size integer default 20,
  p_campaign_id uuid default null
)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with settings as (
    select greatest(1, least(coalesce(p_page, 1), 100000)) as page,
      greatest(1, least(coalesce(p_page_size, 20), 100)) as page_size
  ), filtered as (
    select red.id, 'CAN-' || lpad(red.folio_no::text, greatest(6,length(red.folio_no::text)),'0') as folio, red.table_label as "tableLabel", red.order_ref as "orderRef", red.note, red.created_at as "createdAt", cp.code as "couponCode",
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
    where (p_campaign_id is null or cp.campaign_id = p_campaign_id) and (p_date is null or (
      red.created_at >= (p_date::timestamp at time zone 'America/Santiago')
      and red.created_at < ((p_date + 1)::timestamp at time zone 'America/Santiago')
    )) and (nullif(btrim(p_query), '') is null or strpos(lower(concat_ws(' ',
      cp.code, ca.name, m.full_name, m.member_code, mp.full_name, sp.full_name, su.email, red.consumption_ref, red.table_label, red.order_ref, red.note, 'CAN-' || lpad(red.folio_no::text,greatest(6,length(red.folio_no::text)),'0')
    )), lower(btrim(p_query))) > 0)
  ), paged as (
    select * from filtered order by "createdAt" desc, id desc
      limit (select page_size from settings)
      offset (select (page - 1) * page_size from settings)
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(p) order by p."createdAt" desc, p.id desc) from paged p), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', (select page from settings), 'pageSize', (select page_size from settings));
$$;
revoke all on function public.club_staff_redemption_history_filtered(date, text, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.club_staff_redemption_history_filtered(date, text, integer, integer, uuid) to service_role;
-- Historial paginado de canjes: solo backend; misma autorización staff de canje.
create or replace function public.club_recent_redemptions(p_table_label text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  with settings as (
    select 1 as page,
      6 as page_size
  ), filtered as (
    select red.id, 'CAN-' || lpad(red.folio_no::text,greatest(6,length(red.folio_no::text)),'0') as folio, red.table_label as "tableLabel", red.order_ref as "orderRef", red.note, red.created_at as "createdAt", cp.code as "couponCode",
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
    where red.created_at >= ((now() at time zone 'America/Santiago')::date::timestamp at time zone 'America/Santiago')
      and red.created_at < (((now() at time zone 'America/Santiago')::date + 1)::timestamp at time zone 'America/Santiago')
      and (nullif(btrim(p_table_label),'') is null or lower(btrim(red.table_label))=lower(btrim(p_table_label)))
  ), paged as (
    select * from filtered order by "createdAt" desc, id desc
      limit (select page_size from settings)
      offset (select (page - 1) * page_size from settings)
  )
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(p) order by p."createdAt" desc, p.id desc) from paged p), '[]'::jsonb),
    'total', (select count(*) from filtered), 'page', (select page from settings), 'pageSize', (select page_size from settings));
$$;
revoke all on function public.club_recent_redemptions(text) from public, anon, authenticated;
grant execute on function public.club_recent_redemptions(text) to service_role;
create index if not exists idx_club_redemptions_created_at on public.club_coupon_redemptions(created_at desc, id desc);

