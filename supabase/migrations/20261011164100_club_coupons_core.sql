-- ============================================================
-- Club Costa Mar: campanas, cupones, canjes (Cupones V1)
-- Nada destructivo. La API es la unica autoridad de emision/canje.
-- ============================================================

create table if not exists public.club_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  image_path text,
  type text not null check (type in ('birthday','founders')),
  status text not null default 'draft' check (status in ('draft','active','paused','closed')),
  starts_at timestamptz,
  ends_at timestamptz,
  max_coupons integer check (max_coupons is null or max_coupons >= 0),
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.club_campaigns is 'Campanas del club. Reglas configurables en jsonb sin tocar la PWA.';

create table if not exists public.club_campaign_products (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.club_campaigns(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  role text not null check (role in ('drink','dessert','gift')),
  created_at timestamptz not null default now()
);
create unique index if not exists uq_campaign_product_role
  on public.club_campaign_products(campaign_id, product_id, role);
create index if not exists idx_campaign_products_campaign
  on public.club_campaign_products(campaign_id);

create table if not exists public.club_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  campaign_id uuid not null references public.club_campaigns(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'issued' check (status in ('issued','redeemed','expired','void')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  period_key text,
  created_at timestamptz not null default now()
);
comment on table public.club_coupons is 'Cupones emitidos. code es referencia segura (no contiene datos personales).';
create unique index if not exists uq_coupon_campaign_user_period
  on public.club_coupons(campaign_id, user_id, coalesce(period_key, ''));
create index if not exists idx_coupons_user on public.club_coupons(user_id);
create index if not exists idx_coupons_status on public.club_coupons(status);

create table if not exists public.club_coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.club_coupons(id) on delete restrict,
  staff_user_id uuid references auth.users(id) on delete set null,
  member_user_id uuid not null references auth.users(id) on delete restrict,
  products jsonb not null default '[]'::jsonb,
  consumption_ref text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_redemption_coupon on public.club_coupon_redemptions(coupon_id);
comment on table public.club_coupon_redemptions is 'Canjes confirmados. Un canje por cupon (uq). No reversible sin procedimiento auditado.';

-- NOTA: OTP de telefono diferido. No se crea tabla de verificaciones todavia.
-- club_members.phone_verified queda preparado (default false) para el futuro.

-- RLS
alter table public.club_campaigns enable row level security;
alter table public.club_campaign_products enable row level security;
alter table public.club_coupons enable row level security;
alter table public.club_coupon_redemptions enable row level security;

drop policy if exists "campaigns public read active" on public.club_campaigns;
create policy "campaigns public read active"
  on public.club_campaigns for select
  using (status = 'active');

drop policy if exists "campaign products public read" on public.club_campaign_products;
create policy "campaign products public read"
  on public.club_campaign_products for select
  using (exists (select 1 from public.club_campaigns c where c.id = campaign_id and c.status = 'active'));

drop policy if exists "coupons self read" on public.club_coupons;
create policy "coupons self read"
  on public.club_coupons for select
  to authenticated
  using (auth.uid() = user_id);

-- club_coupon_redemptions: sin politicas => acceso solo backend (service_role).
