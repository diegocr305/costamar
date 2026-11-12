-- ============================================================
-- Archivo de reservas eliminadas (limpieza de pruebas).
-- Antes de borrar una reserva se copia aquí la fila completa con su historial (eventos y avisos),
-- de modo que el panel y los reportes queden limpios pero el borrado sea reversible.
-- Cerrada a clientes: RLS sin políticas, solo backend (service_role).
-- ============================================================
create table if not exists public.reservations_archive (
 id uuid primary key,
 folio bigint not null,
 reservation jsonb not null,
 events jsonb not null default '[]'::jsonb,
 alerts jsonb not null default '[]'::jsonb,
 reason text not null,
 archived_at timestamptz not null default now()
);
comment on table public.reservations_archive is 'Copia completa de reservas eliminadas (fila + eventos + avisos) para poder restaurarlas.';
alter table public.reservations_archive enable row level security;
revoke all on table public.reservations_archive from anon, authenticated;
