-- Costa Mar Platform — Identidad y Roles

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  birth_date date,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Perfil extendido del usuario, vinculado a auth.users.';

create table if not exists public.roles (
  id   smallint generated always as identity primary key,
  name text not null unique
);
comment on table public.roles is 'Catalogo de los 7 roles del sistema.';

create table if not exists public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_id    smallint not null references public.roles (id),
  granted_by uuid references public.profiles (id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
comment on table public.user_roles is 'Asignacion de roles a usuarios. Gestionada solo por el backend.';

create table if not exists public.staff_members (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  employee_code text unique,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
comment on table public.staff_members is 'Empleados internos del restaurante.';

create index if not exists idx_user_roles_user_id on public.user_roles (user_id);
create index if not exists idx_staff_members_profile_id on public.staff_members (profile_id);

insert into public.roles (name)
values
  ('superadmin'),
  ('admin'),
  ('manager'),
  ('kitchen'),
  ('inventory'),
  ('cashier'),
  ('customer')
on conflict (name) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();;
