-- Costa Mar Platform — RLS de Identidad y Roles

-- profiles: cada usuario ve y edita SOLO su propio perfil
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- roles: catalogo de solo lectura para usuarios autenticados
alter table public.roles enable row level security;

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
  on public.roles
  for select
  to authenticated
  using (true);

-- user_roles: SIN politicas para clientes (solo backend service_role)
alter table public.user_roles enable row level security;

-- staff_members: SIN politicas para clientes (solo backend service_role)
alter table public.staff_members enable row level security;;
