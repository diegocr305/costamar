import { chileLocalDateTime, chileLocalToIso } from './chile-date.validation';

export type DeadlineBasis = 'verified' | 'source_timezone' | 'chile_local' | 'unavailable';
export interface DeadlineFields {
  source?: string; closes_raw?: string | null; closes_at?: string | null;
  verified_closes_at?: string | null; effective_closes_at?: string | null;
  deadline_basis?: DeadlineBasis;
}
export const RADAR_DAY_MS = 24 * 60 * 60 * 1000;

function validCivil(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
  if (!m) return false;
  const [y, month, day, hour, minute, second] = m.slice(1).map(v => Number(v ?? 0));
  const date = new Date(Date.UTC(y, month - 1, day));
  return y >= 100 && date.getUTCFullYear() === y && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day && hour < 24 && minute < 60 && second < 60;
}

/** Only explicit instants; never let the browser's own timezone parse civil dates. */
export function deadlineInstant(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !validCivil(value)) return null;
  const instant = Date.parse(value);
  return Number.isFinite(instant) ? instant : null;
}

/** Operational interpretation for these official feeds, visibly marked as unverified. */
export function radarChileDeadline(raw: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(\.\d{1,3})?)?$/.exec(raw);
  if (!m || !validCivil(raw)) return null;
  const local = `${m[1]}T${m[2]}`;
  const iso = chileLocalToIso(local);
  if (!iso) return null;
  const minute = Date.parse(iso);
  if ([-3600000, 3600000].some(shift => chileLocalDateTime(new Date(minute + shift).toISOString()) === local)) return null;
  return new Date(minute + Number(m[3] ?? 0) * 1000 + Number(m[4] ?? 0) * 1000).toISOString();
}

export function resolveRadarDeadline(row: DeadlineFields): { iso: string | null; basis: DeadlineBasis } {
  if (row.deadline_basis !== undefined) {
    return deadlineInstant(row.effective_closes_at) === null ? { iso: null, basis: 'unavailable' } :
      { iso: row.effective_closes_at!, basis: row.deadline_basis };
  }
  if (row.verified_closes_at) return deadlineInstant(row.verified_closes_at) === null ?
    { iso: null, basis: 'unavailable' } : { iso: row.verified_closes_at, basis: 'verified' };
  if (row.closes_at) return deadlineInstant(row.closes_at) === null ?
    { iso: null, basis: 'unavailable' } : { iso: row.closes_at, basis: 'source_timezone' };
  const explicit = deadlineInstant(row.closes_raw);
  if (explicit !== null) return { iso: new Date(explicit).toISOString(), basis: 'source_timezone' };
  const local = ['compra_agil', 'licitacion'].includes(row.source ?? '') ? radarChileDeadline(row.closes_raw ?? '') : null;
  return { iso: local, basis: local ? 'chile_local' : 'unavailable' };
}

export function closingIn24Hours(iso: string | null | undefined, now: number): boolean {
  const at = deadlineInstant(iso);
  return at !== null && at > now && at <= now + RADAR_DAY_MS;
}

export function deadlineRemaining(iso: string | null | undefined, now: number): string {
  const at = deadlineInstant(iso);
  if (at === null) return 'Sin fecha disponible';
  if (at <= now) return 'Vencida';
  const minutes = Math.ceil((at - now) / 60000);
  if (minutes < 60) return `Vence en ${minutes} min`;
  if (at - now <= RADAR_DAY_MS) return `Vence en ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  return `Vence en ${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`;
}
