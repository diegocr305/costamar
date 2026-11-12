// ============================================================
// Edge Function: reservations-digest
// Correo diario (09:00 America/Santiago) para el dueño / encargado con:
//   - las reservas de HOY, por hora
//   - las solicitudes POR CONFIRMAR (las más próximas primero)
//   - cuántas reservas abiertas quedaron con fecha pasada sin cerrar
//
// Datos: RPC public.reservation_daily_digest() (security definer, solo service_role).
// Envío: Resend. Si no hay nada que mostrar, no envía (salvo {"force":true}).
//
// Seguridad: requiere Authorization: Bearer <CRON_SECRET>.
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY   clave de Resend (re_...)
//   REMINDER_FROM    remitente. Para pruebas sin dominio: "Costa Mar <onboarding@resend.dev>"
//   DIGEST_TO        destinatarios separados por coma (con onboarding@resend.dev solo
//                    puede ser el correo dueño de la cuenta Resend)
//   CRON_SECRET      mismo valor que app.settings.edge_cron_secret
//   ADMIN_URL        opcional, por defecto https://admin.restaurantecostamar.cl
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface Booking {
  reference: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedAt: string;
  status: string;
  tableNumbers: number[];
  notes?: string;
  staffNote?: string;
}
interface Digest {
  date: string;
  today: Booking[];
  pending: Booking[];
  stale: number;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REMINDER_FROM = Deno.env.get('REMINDER_FROM') ?? 'Costa Mar <onboarding@resend.dev>';
const DIGEST_TO = (Deno.env.get('DIGEST_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const ADMIN_URL = Deno.env.get('ADMIN_URL') ?? 'https://admin.restaurantecostamar.cl';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const STATUS: Record<string, string> = {
  pending: 'Por confirmar',
  confirmed: 'Confirmada',
  seated: 'En el local',
  completed: 'Finalizada',
  no_show: 'No asistió',
};

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' });
const dayTime = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

function row(b: Booking, withDay: boolean): string {
  const wa = 'https://wa.me/' + b.customerPhone.replace('+', '');
  const tables = b.tableNumbers?.length ? 'Mesas ' + b.tableNumbers.join(' + ') : 'Sin mesa';
  return `<tr>
    <td style="padding:10px 8px;border-bottom:1px solid #e6e2d8;white-space:nowrap;"><strong>${esc(withDay ? dayTime(b.reservedAt) : time(b.reservedAt))}</strong></td>
    <td style="padding:10px 8px;border-bottom:1px solid #e6e2d8;">${esc(b.customerName)} · ${esc(b.partySize)} pers.<br>
      <span style="color:#5a7382;font-size:12px;">${esc(b.reference)} · ${esc(tables)}${b.notes ? ' · “' + esc(b.notes) + '”' : ''}</span></td>
    <td style="padding:10px 8px;border-bottom:1px solid #e6e2d8;font-size:12px;">${esc(STATUS[b.status] ?? b.status)}<br>
      <a href="${esc(wa)}" style="color:#11683d;">WhatsApp</a></td></tr>`;
}

function table(title: string, rows: Booking[], withDay: boolean): string {
  if (!rows.length) return '';
  return `<h2 style="font-family:Georgia,serif;color:#1263a0;font-size:18px;margin:24px 0 8px;">${esc(title)} (${rows.length})</h2>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff;border:1px solid #d8dedb;border-radius:12px;border-collapse:separate;">
  ${rows.map((b) => row(b, withDay)).join('')}</table>`;
}

function html(d: Digest): string {
  // Las pendientes de hoy ya aparecen en "Hoy" con su estado; no se repiten abajo.
  const todayRefs = new Set(d.today.map((b) => b.reference));
  const stale = d.stale > 0
    ? `<p style="background:#fff2d8;color:#8a5d00;padding:12px;border-radius:10px;font-size:14px;">Hay ${d.stale} reserva(s) abiertas con fecha pasada. Ciérralas en el panel (cancelar o “No asistió”).</p>`
    : '';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#faf7f1;font-family:Lato,Segoe UI,system-ui,sans-serif;color:#17324d;">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;">
    <h1 style="font-family:Georgia,serif;color:#1263a0;font-size:24px;margin:0 0 4px;">Reservas de hoy</h1>
    <p style="margin:0 0 8px;color:#5a7382;font-size:14px;">${esc(d.today.length)} para hoy · ${esc(d.pending.length)} por confirmar</p>
    ${stale}
    ${table('Hoy, por hora', d.today, false)}
    ${table('Por confirmar en otros días', d.pending.filter((b) => !todayRefs.has(b.reference)), true)}
    <p style="margin:28px 0 0;"><a href="${esc(ADMIN_URL)}/reservas" style="display:inline-block;background:#ef8a42;color:#172e38;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Abrir reservas</a></p>
    <p style="font-size:12px;color:#5a7382;margin-top:20px;">Revisa también las mesas ocupadas en Fudo antes de confirmar.</p>
  </div></body></html>`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (!CRON_SECRET || (req.headers.get('Authorization') ?? '') !== `Bearer ${CRON_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY not set' }, 500);
  if (!DIGEST_TO.length) return json({ error: 'DIGEST_TO not set' }, 500);

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  const { data, error } = await admin.rpc('reservation_daily_digest');
  if (error) return json({ error: error.message }, 500);
  const digest = data as Digest;

  if (!force && !digest.today.length && !digest.pending.length && !digest.stale) {
    return json({ sent: false, reason: 'nothing to report' });
  }

  const subject = `Reservas de hoy: ${digest.today.length} · por confirmar: ${digest.pending.length}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMINDER_FROM, to: DIGEST_TO, subject, html: html(digest) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return json({ sent: false, error: `resend:${res.status}:${text}`.slice(0, 500) }, 502);
  }
  return json({ sent: true, today: digest.today.length, pending: digest.pending.length, stale: digest.stale });
});
