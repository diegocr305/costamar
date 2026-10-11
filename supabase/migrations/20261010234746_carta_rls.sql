-- Costa Mar Platform — RLS de la Carta Digital
-- Lectura publica (anon) de contenido activo/disponible.
-- Escritura exclusiva del backend (service_role bypasea RLS).

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;

-- categories: lectura publica de las activas
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read"
  on public.categories
  for select
  to anon, authenticated
  using (is_active = true);

-- products: lectura publica solo de disponibles (Propiedad 13)
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read"
  on public.products
  for select
  to anon, authenticated
  using (is_available = true);

-- variants: lectura publica de las activas
drop policy if exists "variants_public_read" on public.product_variants;
create policy "variants_public_read"
  on public.product_variants
  for select
  to anon, authenticated
  using (is_active = true);

-- images: lectura publica
drop policy if exists "images_public_read" on public.product_images;
create policy "images_public_read"
  on public.product_images
  for select
  to anon, authenticated
  using (true);;
