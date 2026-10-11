-- Costa Mar Platform — Endurecer funciones SECURITY DEFINER
-- Revoca EXECUTE a anon/authenticated para que no sean invocables como RPC.
-- handle_new_user solo debe ejecutarse desde el trigger on_auth_user_created.

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- rls_auto_enable es un event trigger del proyecto; no debe ser RPC publica.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Documentar la intencion de user_roles y staff_members sin politicas:
-- acceso exclusivo del backend via service_role (que bypasea RLS).
comment on table public.user_roles is 'Asignacion de roles. RLS activo sin politicas: acceso solo backend (service_role).';
comment on table public.staff_members is 'Empleados internos. RLS activo sin politicas: acceso solo backend (service_role).';;
