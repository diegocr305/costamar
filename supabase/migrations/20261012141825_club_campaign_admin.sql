-- Administración de promociones. Cumpleaños permanece general y sin cupos.
alter table public.club_campaigns drop constraint club_campaigns_type_check;
alter table public.club_campaigns add constraint club_campaigns_type_check check (type in ('birthday','founders','promotion'));
alter table public.club_campaigns add constraint club_campaigns_birthday_unlimited check (type <> 'birthday' or (max_coupons is null and rules->>'validityDays' is null));
alter table public.club_campaigns add constraint club_campaigns_dates_order check (starts_at is null or ends_at is null or ends_at > starts_at);
alter table public.club_campaigns add constraint club_promotions_active_bounded check (type <> 'promotion' or status <> 'active' or (max_coupons is not null and max_coupons > 0 and ends_at is not null));
create unique index if not exists uq_club_birthday_campaign on public.club_campaigns(type) where type = 'birthday';

create table public.club_campaign_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.club_campaigns(id) on delete restrict,
  staff_user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in ('create','update')),
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.club_campaign_events enable row level security;
comment on table public.club_campaign_events is 'Cambios de campañas auditados. RLS sin políticas: solo backend.';
create index idx_campaign_events_campaign on public.club_campaign_events(campaign_id,created_at desc);
create index idx_campaign_events_staff on public.club_campaign_events(staff_user_id);

create or replace function public.club_admin_campaigns()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'slug',c.slug,'name',c.name,'description',c.description,'imagePath',c.image_path,
    'type',c.type,'status',c.status,'startsAt',c.starts_at,'endsAt',c.ends_at,'maxCoupons',c.max_coupons,'rules',c.rules,
    'stats',jsonb_build_object('issued',s.total,'available',s.available,'redeemed',s.redeemed,'expired',s.expired,'void',s.void,
      'remaining',case when c.max_coupons is null then null else greatest(c.max_coupons-s.total,0) end),
    'products',coalesce(products.items,'[]'::jsonb)
  ) order by c.created_at,c.id),'[]'::jsonb)
  from public.club_campaigns c
  cross join lateral (
    select count(*) as total,
      count(*) filter(where q.status='issued' and (q.expires_at is null or q.expires_at > now())) as available,
      count(*) filter(where q.status='redeemed') as redeemed,
      count(*) filter(where q.status='expired' or (q.status='issued' and q.expires_at <= now())) as expired,
      count(*) filter(where q.status='void') as void
    from public.club_coupons q where q.campaign_id=c.id
  ) s
  left join lateral (
    select jsonb_agg(jsonb_build_object('productId',p.id,'role',cp.role,'name',p.name,'isAvailable',p.is_available,
      'imagePath',(select i.storage_path from public.product_images i where i.product_id=p.id order by i.position,i.id limit 1)) order by cp.role,p.name) as items
    from public.club_campaign_products cp join public.products p on p.id=cp.product_id where cp.campaign_id=c.id
  ) products on true;
$$;
revoke all on function public.club_admin_campaigns() from public,anon,authenticated;
grant execute on function public.club_admin_campaigns() to service_role;

create or replace function public.club_admin_save_campaign(p_actor uuid,p_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.club_campaigns;
  v_before jsonb;
  v_products_before jsonb;
  v_id uuid := p_id;
  v_rules jsonb;
  v_count bigint;
begin
  if not exists(select 1 from auth.users where id=p_actor and raw_app_meta_data->>'role' in ('superadmin','admin','manager')) then raise exception 'CAMPAIGN_ADMIN_REQUIRED'; end if;
  if p_id is null then
    if nullif(btrim(p_input->>'name'),'') is null or (p_input->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or p_input->>'slug' is null then raise exception 'CAMPAIGN_BENEFIT_REQUIRED'; end if;
    insert into public.club_campaigns(slug,name,type,status,rules)
      values(p_input->>'slug',btrim(p_input->>'name'),'promotion','draft','{"minAge":18,"requiresCompleteProfile":true,"requiresConsumption":true,"alcoholRequiresIdCheck":true}'::jsonb)
      returning id into v_id;
  end if;
  select * into v_campaign from public.club_campaigns where id=v_id for update;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('productId',product_id,'role',role)),'[]'::jsonb) into v_products_before from public.club_campaign_products where campaign_id=v_id;
  if p_id is not null then v_before := to_jsonb(v_campaign)||jsonb_build_object('products',v_products_before); end if;
  if p_input ? 'name' then v_campaign.name := btrim(p_input->>'name'); end if;
  if nullif(v_campaign.name,'') is null then raise exception 'CAMPAIGN_BENEFIT_REQUIRED'; end if;
  if p_input ? 'description' then v_campaign.description := nullif(btrim(p_input->>'description'),''); end if;
  if p_input ? 'imagePath' then v_campaign.image_path := nullif(btrim(p_input->>'imagePath'),''); end if;
  if p_input ? 'status' then v_campaign.status := p_input->>'status'; end if;
  if p_input ? 'startsAt' then v_campaign.starts_at := (p_input->>'startsAt')::timestamptz; end if;
  if p_input ? 'endsAt' then v_campaign.ends_at := (p_input->>'endsAt')::timestamptz; end if;
  if p_input ? 'maxCoupons' then v_campaign.max_coupons := (p_input->>'maxCoupons')::integer; end if;
  v_rules := v_campaign.rules;
  if p_input ? 'validityDays' then
    if p_input->>'validityDays' is not null and (p_input->>'validityDays')::int < 1 then raise exception 'CAMPAIGN_DATES_INVALID'; end if;
    v_rules := v_rules || jsonb_build_object('validityDays',(p_input->>'validityDays')::int,'expiryPending',p_input->>'validityDays' is null);
  end if;
  if p_input ? 'benefit' then v_rules := v_rules||jsonb_build_object('benefit',btrim(p_input->>'benefit')); end if;
  if v_campaign.type='birthday' and (v_campaign.max_coupons is not null or v_rules->>'validityDays' is not null) then raise exception 'BIRTHDAY_UNLIMITED'; end if;
  if v_campaign.starts_at is not null and v_campaign.ends_at is not null and v_campaign.ends_at <= v_campaign.starts_at then raise exception 'CAMPAIGN_DATES_INVALID'; end if;
  select count(*) into v_count from public.club_coupons where campaign_id=v_id;
  if v_campaign.max_coupons is not null and v_campaign.max_coupons < v_count then raise exception 'CAMPAIGN_LIMIT_TOO_LOW'; end if;
  if v_campaign.type='promotion' and nullif(btrim(v_rules->>'benefit'),'') is null then raise exception 'CAMPAIGN_BENEFIT_REQUIRED'; end if;
  if v_campaign.type='promotion' and v_campaign.status='active' and (v_campaign.max_coupons is null or v_campaign.max_coupons <= 0 or v_campaign.ends_at is null or v_campaign.ends_at <= now()) then raise exception 'PROMOTION_NEEDS_LIMIT_AND_END'; end if;
  update public.club_campaigns set name=v_campaign.name,description=v_campaign.description,image_path=v_campaign.image_path,
    status=v_campaign.status,starts_at=v_campaign.starts_at,ends_at=v_campaign.ends_at,max_coupons=v_campaign.max_coupons,rules=v_rules,updated_at=now()
    where id=v_id;
  if p_input ? 'products' then
    if jsonb_typeof(p_input->'products') <> 'array' then raise exception 'CAMPAIGN_PRODUCTS_INVALID'; end if;
    if exists(select 1 from jsonb_to_recordset(p_input->'products') as x("productId" uuid,role text) left join public.products p on p.id=x."productId"
      where p.id is null or x.role is null or x.role not in ('drink','dessert','gift'))
      or exists(select 1 from jsonb_to_recordset(p_input->'products') as x("productId" uuid,role text) group by x."productId",x.role having count(*) > 1)
    then raise exception 'CAMPAIGN_PRODUCTS_INVALID'; end if;
    delete from public.club_campaign_products where campaign_id=v_id;
    insert into public.club_campaign_products(campaign_id,product_id,role)
      select v_id,x."productId",x.role from jsonb_to_recordset(p_input->'products') as x("productId" uuid,role text);
  end if;
  insert into public.club_campaign_events(campaign_id,staff_user_id,event,before_state,after_state)
    select v_id,p_actor,case when p_id is null then 'create' else 'update' end,v_before,
      to_jsonb(c)||jsonb_build_object('products',coalesce((select jsonb_agg(jsonb_build_object('productId',product_id,'role',role)) from public.club_campaign_products where campaign_id=v_id),'[]'::jsonb))
      from public.club_campaigns c where id=v_id;
  return (select item.value from jsonb_array_elements(public.club_admin_campaigns()) as item(value) where item.value->>'id'=v_id::text);
end;
$$;
revoke all on function public.club_admin_save_campaign(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.club_admin_save_campaign(uuid,uuid,jsonb) to service_role;

create or replace function public.club_admin_campaign_coupons(p_campaign_id uuid,p_status text default null,p_query text default null,p_page integer default 1,p_page_size integer default 20)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.club_campaigns where id=p_campaign_id) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  with settings as (select greatest(1,least(coalesce(p_page,1),100000)) as page,greatest(1,least(coalesce(p_page_size,20),100)) as page_size),
  coupon_rows as (
    select q.id,q.code,q.issued_at as "issuedAt",q.expires_at as "expiresAt",q.redeemed_at as "redeemedAt",
      case when q.status='issued' and q.expires_at <= now() then 'expired' else q.status end as status,
      coalesce(m.full_name,'Socio') as "memberName",m.member_code as "memberCode"
    from public.club_coupons q left join public.club_members m on m.user_id=q.user_id where q.campaign_id=p_campaign_id
      and (nullif(btrim(p_query),'') is null or strpos(lower(concat_ws(' ',q.code,m.full_name,m.member_code)),lower(btrim(p_query))) > 0)
  ), filtered as (select * from coupon_rows where p_status is null or status=p_status),
  paged as (select * from filtered order by "issuedAt" desc,id desc limit (select page_size from settings) offset (select (page-1)*page_size from settings))
  select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(p) order by p."issuedAt" desc,p.id desc) from paged p),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',(select page from settings),'pageSize',(select page_size from settings)) into v_result;
  return v_result;
end;
$$;
revoke all on function public.club_admin_campaign_coupons(uuid,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.club_admin_campaign_coupons(uuid,text,text,integer,integer) to service_role;

create or replace function public.issue_campaign_coupon(p_campaign_id uuid,p_user_id uuid,p_at timestamptz default now())
returns public.club_coupons language plpgsql security definer set search_path = ''
as $$
declare v_campaign public.club_campaigns; v_member public.club_members; v_coupon public.club_coupons; v_expiry timestamptz; v_days int;
begin
  select * into v_campaign from public.club_campaigns where id=p_campaign_id for update;
  if not found or v_campaign.type='birthday' or v_campaign.status <> 'active' then return null; end if;
  if (v_campaign.starts_at is not null and p_at < v_campaign.starts_at) or (v_campaign.ends_at is not null and p_at >= v_campaign.ends_at) then return null; end if;
  select * into v_member from public.club_members where user_id=p_user_id;
  if not found or v_member.status <> 'active' or nullif(btrim(v_member.full_name),'') is null or nullif(btrim(v_member.phone),'') is null
    or v_member.birth_date is null or extract(year from age((p_at at time zone 'America/Santiago')::date,v_member.birth_date)) < 18 then return null; end if;
  select * into v_coupon from public.club_coupons where campaign_id=p_campaign_id and user_id=p_user_id and coalesce(period_key,'')='';
  if found then return v_coupon; end if;
  if v_campaign.max_coupons is not null and (select count(*) from public.club_coupons where campaign_id=p_campaign_id) >= v_campaign.max_coupons then return null; end if;
  v_days := (v_campaign.rules->>'validityDays')::int;
  v_expiry := case when v_days is null then v_campaign.ends_at else least(p_at + make_interval(days=>v_days),v_campaign.ends_at) end;
  insert into public.club_coupons(code,campaign_id,user_id,expires_at,issued_at)
    values((case when v_campaign.type='founders' then 'FND-' else 'PRM-' end)||upper(replace(gen_random_uuid()::text,'-','')),p_campaign_id,p_user_id,v_expiry,p_at) returning * into v_coupon;
  insert into public.club_auth_events(user_id,event,meta) values(p_user_id,'enroll',jsonb_build_object('benefit',v_campaign.slug,'coupon_id',v_coupon.id));
  return v_coupon;
end;
$$;
revoke all on function public.issue_campaign_coupon(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.issue_campaign_coupon(uuid,uuid,timestamptz) to service_role;

create or replace function public.assign_club_benefits(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_campaign uuid;
begin
  perform public.issue_birthday_coupon(p_user_id);
  for v_campaign in select id from public.club_campaigns where type <> 'birthday' and status='active' order by id loop
    perform public.issue_campaign_coupon(v_campaign,p_user_id);
  end loop;
end;
$$;
revoke all on function public.assign_club_benefits(uuid) from public,anon,authenticated;
grant execute on function public.assign_club_benefits(uuid) to service_role;

-- Mantener compatibilidad con la ruta antigua de bienvenida, con fechas y cupos.
create or replace function public.issue_founder_coupon(p_user_id uuid)
returns public.club_coupons language plpgsql security definer set search_path = ''
as $$
declare v_campaign public.club_campaigns; v_coupon public.club_coupons;
begin
  select * into v_campaign from public.club_campaigns where slug='fundadores-50';
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if v_campaign.status <> 'active' then raise exception 'CAMPAIGN_NOT_ACTIVE'; end if;
  v_coupon := public.issue_campaign_coupon(v_campaign.id,p_user_id);
  if v_coupon.id is null then raise exception 'CAMPAIGN_NOT_ELIGIBLE_OR_FULL'; end if;
  return v_coupon;
end;
$$;
revoke all on function public.issue_founder_coupon(uuid) from public,anon,authenticated;
grant execute on function public.issue_founder_coupon(uuid) to service_role;
-- Historial paginado de canjes: solo backend; misma autorización staff de canje.
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
    where (p_campaign_id is null or cp.campaign_id = p_campaign_id) and (p_date is null or (
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
revoke all on function public.club_staff_redemption_history_filtered(date, text, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.club_staff_redemption_history_filtered(date, text, integer, integer, uuid) to service_role;
create index if not exists idx_club_redemptions_created_at on public.club_coupon_redemptions(created_at desc, id desc);


-- Validación del catálogo al canjear. Los nombres se guardan como snapshot.
create or replace function public.redeem_coupon(p_code text,p_staff_user_id uuid,p_products jsonb default '[]'::jsonb,p_consumption_ref text default null)
returns public.club_coupon_redemptions language plpgsql security definer set search_path = ''
as $$
declare
  v_coupon public.club_coupons;
  v_red public.club_coupon_redemptions;
  v_allowed jsonb;
  v_selected jsonb := coalesce(p_products,'[]'::jsonb);
  v_snapshot jsonb := '[]'::jsonb;
begin
  if not exists(select 1 from auth.users where id=p_staff_user_id and raw_app_meta_data->>'role' in ('superadmin','admin','manager','cashier')) then raise exception 'STAFF_NOT_AUTHORIZED'; end if;
  if nullif(btrim(p_consumption_ref),'') is null then raise exception 'CONSUMPTION_REQUIRED'; end if;
  select * into v_coupon from public.club_coupons where code=p_code for update;
  if not found then raise exception 'COUPON_NOT_FOUND'; end if;
  if v_coupon.status='redeemed' then raise exception 'ALREADY_REDEEMED'; end if;
  if v_coupon.status <> 'issued' then raise exception 'COUPON_NOT_REDEEMABLE'; end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then raise exception 'COUPON_EXPIRED'; end if;
  if not exists(select 1 from public.club_members where user_id=v_coupon.user_id and status='active') then raise exception 'MEMBER_NOT_ACTIVE'; end if;
  if jsonb_typeof(v_selected) <> 'array' or exists(select 1 from jsonb_array_elements(v_selected) p where jsonb_typeof(p) <> 'object') then raise exception 'CAMPAIGN_PRODUCTS_INVALID'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('productId',p.id,'role',cp.role,'name',p.name,'available',p.is_available)),'[]'::jsonb)
    into v_allowed from public.club_campaign_products cp join public.products p on p.id=cp.product_id where cp.campaign_id=v_coupon.campaign_id;
  if jsonb_array_length(v_allowed) > 0 then
    if exists(select 1 from jsonb_array_elements(v_selected) x where not exists(select 1 from jsonb_array_elements(v_allowed) a
      where a->>'productId'=x->>'productId' and a->>'role'=x->>'role' and (a->>'available')::boolean))
      or exists(select 1 from jsonb_array_elements(v_allowed) a where not exists(select 1 from jsonb_array_elements(v_selected) x where x->>'role'=a->>'role'))
      or exists(select 1 from jsonb_array_elements(v_selected) x group by x->>'role' having count(*) > 1)
    then raise exception 'CAMPAIGN_PRODUCTS_INVALID'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('productId',a->>'productId','role',a->>'role','name',a->>'name')),'[]'::jsonb)
      into v_snapshot from jsonb_array_elements(v_selected) x join jsonb_array_elements(v_allowed) a on a->>'productId'=x->>'productId' and a->>'role'=x->>'role';
  elsif jsonb_array_length(v_selected) > 0 then
    raise exception 'CAMPAIGN_PRODUCTS_INVALID';
  end if;
  update public.club_coupons set status='redeemed',redeemed_at=now() where id=v_coupon.id;
  insert into public.club_coupon_redemptions(coupon_id,staff_user_id,member_user_id,products,consumption_ref)
    values(v_coupon.id,p_staff_user_id,v_coupon.user_id,v_snapshot,btrim(p_consumption_ref)) returning * into v_red;
  return v_red;
end;
$$;
revoke all on function public.redeem_coupon(text,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.redeem_coupon(text,uuid,jsonb,text) to service_role;
