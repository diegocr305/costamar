import { CLUB_MIN_AGE } from '../types/coupons';

/**
 * Utilidades de edad y cumpleaños para el Club, en zona America/Santiago.
 *
 * Se usa el calendario (año/mes/día) en la TZ de Chile, evitando errores por
 * desfase de huso. La "fecha de hoy" se puede inyectar para tests.
 */

const TZ = 'America/Santiago';

/** Devuelve {year, month, day} de una fecha en la zona de Chile. */
export function civilDateInTz(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  // en-CA produce formato YYYY-MM-DD, estable para parsear.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Parsea 'YYYY-MM-DD' a componentes numéricos. Null si inválida. */
export function parseIsoDate(
  iso: string,
): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Edad cumplida (años completos) a la fecha de referencia, TZ Chile. */
export function ageOn(birthIso: string, now: Date = new Date()): number | null {
  const b = parseIsoDate(birthIso);
  if (!b) return null;
  const t = civilDateInTz(now);
  let age = t.year - b.year;
  // Resta un año si aún no ha llegado el mes/día de cumpleaños.
  if (t.month < b.month || (t.month === b.month && t.day < b.day)) {
    age -= 1;
  }
  return age;
}

/** True si tiene al menos la edad mínima del club (18). */
export function isAdult(birthIso: string, now: Date = new Date()): boolean {
  const age = ageOn(birthIso, now);
  return age !== null && age >= CLUB_MIN_AGE;
}

/**
 * True si HOY (TZ Chile) está dentro del MES calendario del cumpleaños.
 * Caso 29‑feb: si el año actual no es bisiesto, el beneficio aplica igual
 * durante todo febrero (comparamos solo el mes).
 */
export function isBirthdayMonth(birthIso: string, now: Date = new Date()): boolean {
  const b = parseIsoDate(birthIso);
  if (!b) return false;
  const t = civilDateInTz(now);
  return t.month === b.month;
}

/**
 * Clave de periodo anual para la unicidad del cupón de cumpleaños.
 * Un canje por año calendario (TZ Chile).
 */
export function birthdayPeriodKey(now: Date = new Date()): string {
  const t = civilDateInTz(now);
  return `y-${t.year}`;
}
