-- Ampliar club_members para cupones: fecha de nacimiento y verificacion de telefono.
-- No destructivo: columnas nullable con defaults seguros.
alter table public.club_members
  add column if not exists birth_date date,
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;

comment on column public.club_members.birth_date is 'Fecha de nacimiento del socio (para elegibilidad por edad/cumpleanos). TZ America/Santiago en la logica.';
comment on column public.club_members.phone_verified is 'Telefono verificado por OTP. Requisito para promos limitadas (Fase 2).';
