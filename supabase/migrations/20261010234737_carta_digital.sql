-- Costa Mar Platform — Carta Digital

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  position    smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
comment on table public.categories is 'Categorias de la carta.';

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.categories (id),
  name         text not null,
  description  text,
  base_price   numeric(10,2) not null check (base_price >= 0),
  is_available boolean not null default true,
  position     smallint not null default 0,
  -- Trazabilidad de importacion (scraper). Idempotencia por (source, source_id).
  source       text,
  source_id    text,
  source_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.products is 'Productos de la carta. source/source_id para importacion idempotente.';
create unique index if not exists uq_products_source on public.products (source, source_id) where source is not null and source_id is not null;
create index if not exists idx_products_category on public.products (category_id);

create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name       text not null,
  price      numeric(10,2) not null check (price >= 0),
  is_active  boolean not null default true
);
comment on table public.product_variants is 'Variantes de producto con precio propio.';
create index if not exists idx_variants_product on public.product_variants (product_id);

create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  position     smallint not null default 0,
  created_at   timestamptz not null default now()
);
comment on table public.product_images is 'Imagenes de producto en Supabase Storage.';
create index if not exists idx_images_product on public.product_images (product_id);;
