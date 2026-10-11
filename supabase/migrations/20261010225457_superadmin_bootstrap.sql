-- Costa Mar Platform — Bootstrap de superadmin por correo designado
-- Lista controlada de correos que seran superadmin al autenticarse.

create table if not exists public.designated_superadmins (
  email      text primary key,
  created_at timestamptz not null default now()
);
comment on table public.designated_superadmins is 'Correos que reciben rol superadmin automaticamente al autenticarse. Gestion solo backend.';

alter table public.designated_superadmins enable row level security;
-- Sin politicas: acceso exclusivo backend (service_role).

-- Correo designado inicial
insert into public.designated_superadmins (email)
values ('diegocr305@gmail.com')
on conflict (email) do nothing;

-- Funcion que promueve a superadmin si el email esta designado.
-- Se dispara al crear el usuario en auth.users (despues del perfil).
create or replace function public.promote_designated_superadmin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_id smallint;
begin
  if new.email is null then
    return new;
  end if;

  if exists (select 1 from public.designated_superadmins d where d.email = new.email) then
    select id into v_role_id from public.roles where name = 'superadmin';
    if v_role_id is not null then
      insert into public.user_roles (user_id, role_id)
      values (new.id, v_role_id)
      on conflict (user_id, role_id) do nothing;

      update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'superadmin')
      where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.promote_designated_superadmin() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_promote on auth.users;
create trigger on_auth_user_created_promote
  after insert on auth.users
  for each row
  execute function public.promote_designated_superadmin();;
