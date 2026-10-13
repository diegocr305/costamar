import { closingIn24Hours, deadlineRemaining, radarChileDeadline, resolveRadarDeadline } from '@costamar/shared';
import { explicitDate, normalizeAgil, normalizeLicitacion } from './radar.normalize';
const now = Date.parse('2026-10-12T23:00:00Z');
const future = (minutes: number) => new Date(now + minutes * 60000).toISOString();
describe('Radar: instantes y contador compartidos por frontend/backend', () => {
  it.each([[30,true],[5*60,true],[23*60+59,true],[24*60,true],[25*60,false],[-10,false],[0,false]])('cierre a %s minutos', (minutes, included) => {
    expect(closingIn24Hours(future(minutes),now)).toBe(included);
  });
  it.each([null, '', 'inválida', '2026-02-30T10:00:00Z', '2026-10-13T24:00:00Z'])('rechaza cierre ausente/inválido %s', iso => {
    expect(closingIn24Hours(iso,now)).toBe(false);expect(deadlineRemaining(iso,now)).toBe('Sin fecha disponible');
  });
  it('muestra minutos, horas/minutos, días y vencimiento con el mismo reloj', () => {
    expect(deadlineRemaining(future(42),now)).toBe('Vence en 42 min');
    expect(deadlineRemaining(future(18*60+35),now)).toBe('Vence en 18 h 35 min');
    expect(deadlineRemaining(future(24*60),now)).toBe('Vence en 24 h 0 min');
    expect(deadlineRemaining(future(49*60),now)).toBe('Vence en 2 d 1 h');
    expect(deadlineRemaining(future(-10),now)).toBe('Vencida');
  });
  it('convierte Chile con verano/invierno y conserva segundos', () => {
    expect(radarChileDeadline('2026-10-13 10:00')).toBe('2026-10-13T13:00:00.000Z');
    expect(radarChileDeadline('2026-07-13T10:00:35.123')).toBe('2026-07-13T14:00:35.123Z');
    expect(explicitDate('2026-10-13T10:00:00-03:00')).toBe('2026-10-13T13:00:00.000Z');
    expect(explicitDate('2026-02-30T10:00:00Z')).toBeNull();
  });
  it('rechaza huecos y repeticiones DST y fechas normalizadas accidentalmente', () => {
    expect(radarChileDeadline('2026-09-06 00:30')).toBeNull();
    expect(radarChileDeadline('2026-04-04 23:30')).toBeNull();
    expect(radarChileDeadline('2026-02-30 10:00')).toBeNull();
    expect(radarChileDeadline('2026-10-13 24:00')).toBeNull();
  });
  it('prioriza confirmación manual, zona explícita y luego interpretación local', () => {
    const row = {source:'compra_agil',closes_raw:'2026-10-13 10:00',closes_at:future(1500),verified_closes_at:future(30)};
    expect(resolveRadarDeadline(row)).toEqual({iso:future(30),basis:'verified'});
    expect(resolveRadarDeadline({...row,verified_closes_at:null}).basis).toBe('source_timezone');
    expect(resolveRadarDeadline({...row,verified_closes_at:null,closes_at:null}).basis).toBe('chile_local');
    expect(resolveRadarDeadline({source:'desconocida',closes_raw:row.closes_raw}).iso).toBeNull();
  });
  it('usa únicamente el cierre de recepción de ofertas en las dos fuentes', () => {
    const close=future(30),other=future(1500);
    const agil=normalizeAgil({codigo:'999-1-COT26',nombre:'Prueba',estado:{codigo:'publicada'},fechas:{fecha_cierre:close,fecha_publicacion:other,fecha_ultimo_cambio:other}});
    const lic=normalizeLicitacion({CodigoExterno:'999-1-L126',Nombre:'Prueba',CodigoEstado:5,Fechas:{FechaCierre:close,FechaPublicacion:other,FechaAdjudicacion:other,FechaUltimaModificacion:other}});
    expect(agil.closes_at).toBe(close);expect(lic.closes_at).toBe(close);
  });
});
