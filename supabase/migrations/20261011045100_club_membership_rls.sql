-- ============================================================
-- Club Costa Mar: RLS de las tablas de membresia
-- Cada socio ve/edita solo sus filas. Escrituras privilegiadas
-- (enroll, member_code, auditoria) las hace el backend con service_role.
-- ============================================================

alter table public.club_members enable row level security;
alter table public.club_member_preferences enable row level security;
alter table public.club_consents enable row level security;
alter table public.club_auth_events enable row level security;

-- club_members: el socio puede LEER su propia fila. Escrituras solo backend.
drop policy if exists "club_members self read" on public.club_members;
create policy "club_members self read"
  on public.club_members for select
  to authenticated
  using (auth.uid() = user_id);

-- club_member_preferences: el socio lee y actualiza sus preferencias.
drop policy if exists "club_prefs self read" on public.club_member_preferences;
create policy "club_prefs self read"
  on public.club_member_preferences for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "club_prefs self update" on public.club_member_preferences;
create policy "club_prefs self update"
  on public.club_member_preferences for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- club_consents: el socio puede LEER sus consentimientos. Insert via backend.
drop policy if exists "club_consents self read" on public.club_consents;
create policy "club_consents self read"
  on public.club_consents for select
  to authenticated
  using (auth.uid() = user_id);

-- club_auth_events: sin politicas para authenticated => solo backend (service_role).
