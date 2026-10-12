/** Conversión explícita de horas de formulario en America/Santiago (incluye DST). */
export function chileLocalDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (name: string) => parts.find(p => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function chileLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const wanted = Date.UTC(y, m - 1, d, h, min);
  let candidate = wanted;
  for (let i = 0; i < 3; i++) {
    const civil = chileLocalDateTime(new Date(candidate).toISOString());
    candidate += wanted - Date.parse(civil + ':00Z');
  }
  const result = new Date(candidate).toISOString();
  return chileLocalDateTime(result) === local ? result : null;
}
