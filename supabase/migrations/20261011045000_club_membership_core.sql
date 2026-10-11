-- ============================================================
-- Club Costa Mar: identidad y membresia digital
-- Identidad del socio = auth.users.id. Separado de user_roles.
-- ============================================================

-- Socios del club
create table if not exists public.club_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  member_code text not null unique,
  full_name text not null check (char_length(full_name) between 1 and 120),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{6,20}$'),
  status text not null default 'active' check (status in ('active','suspended')),
  level text not null default 'bronce' check (level in ('bronce','plata','oro')),
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.club_members is 'Socios del Club Costa Mar. Identidad = auth.users.id. Alta idempotente por user_id.';
create index if not exists idx_club_members_status on public.club_members(status);

-- Preferencias de comunicaciones (marketing opcional e independiente)
create table if not exists public.club_member_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  marketing_email boolean not null default false,
  marketing_whatsapp boolean not null default false,
  language text not null default 'es',
  updated_at timestamptz not null default now()
);
comment on table public.club_member_preferences is 'Preferencias de comunicaciones del socio. Marketing separado del consentimiento necesario.';

-- Consentimientos versionados (terminos, privacidad, marketing)
create table if not exists public.club_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('terms','privacy','marketing')),
  version text not null,
  granted boolean not null,
  granted_at timestamptz not null default now(),
  ip inet
);
comment on table public.club_consents is 'Historial de consentimientos versionados. Auditoria legal.';
create index if not exists idx_club_consents_user on public.club_consents(user_id);
create unique index if not exists uq_club_consents_user_type_version on public.club_consents(user_id, type, version);

-- Auditoria minima de eventos de autenticacion/membresia
create table if not exists public.club_auth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in ('login','enroll','profile_update','consent')),
  meta jsonb,
  created_at timestamptz not null default now()
);
comment on table public.club_auth_events is 'Auditoria minima de eventos del club.';
create index if not exists idx_club_auth_events_user on public.club_auth_events(user_id, created_at desc);
