import {
  ageOn,
  birthdayPeriodKey,
  isAdult,
  isBirthdayMonth,
  parseIsoDate,
} from '@costamar/shared';

describe('age.validation (TZ America/Santiago)', () => {
  it('calcula edad con años completos', () => {
    const now = new Date('2026-05-20T12:00:00Z');
    expect(ageOn('1990-05-20', now)).toBe(36);
    // un día antes del cumpleaños aún no cumple
    expect(ageOn('1990-05-21', now)).toBe(35);
  });

  it('isAdult respeta el umbral de 18', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(isAdult('2008-01-01', now)).toBe(true); // 18 exactos
    expect(isAdult('2009-01-02', now)).toBe(false); // 16
  });

  it('rechaza fechas inválidas', () => {
    expect(parseIsoDate('no-fecha')).toBeNull();
    expect(ageOn('no-fecha')).toBeNull();
    expect(isAdult('no-fecha')).toBe(false);
  });

  it('isBirthdayMonth: elegible durante todo el mes del cumpleaños', () => {
    const enMayo = new Date('2026-05-02T12:00:00Z');
    expect(isBirthdayMonth('1990-05-28', enMayo)).toBe(true); // mismo mes
    const enJunio = new Date('2026-06-02T12:00:00Z');
    expect(isBirthdayMonth('1990-05-28', enJunio)).toBe(false); // mes distinto
  });

  it('cumpleaños 29-feb: elegible todo febrero aunque el año no sea bisiesto', () => {
    const feb2026 = new Date('2026-02-15T12:00:00Z'); // 2026 no bisiesto
    expect(isBirthdayMonth('2000-02-29', feb2026)).toBe(true);
    const mar2026 = new Date('2026-03-01T12:00:00Z');
    expect(isBirthdayMonth('2000-02-29', mar2026)).toBe(false);
  });

  it('birthdayPeriodKey cambia por año (1 canje por año)', () => {
    expect(birthdayPeriodKey(new Date('2026-05-20T12:00:00Z'))).toBe('y-2026');
    expect(birthdayPeriodKey(new Date('2027-05-20T12:00:00Z'))).toBe('y-2027');
  });
});
