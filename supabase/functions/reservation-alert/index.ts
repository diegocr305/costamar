// ============================================================
// Edge Function: reservation-alert
// Aviso por correo al encargado cuando entra una solicitud de reserva (web / Club), y un único
// recordatorio si una visita de HOY sigue pendiente 1 hora después.
//
// La decisión de CUÁNDO avisar (horario 08:00-23:00, tope por hora, un aviso por reserva) vive en la
// base (reservation_alert_enqueue / reservation_alert_reminders). Esta función solo:
//   1) recibe { alertId }                       (llamada por pg_net con Bearer CRON_SECRET)
//   2) lee los datos          -> reservation_alert_payload(alertId)
//   3) envía el correo        -> Resend
//   4) cierra el aviso        -> reservation_alert_mark(alertId, sent | failed | skipped)
//
// Si la reserva ya fue gestionada (confirmada, cancelada...) no se envía nada.
//
// Secrets: RESEND_API_KEY, REMINDER_FROM, DIGEST_TO (destinatarios), CRON_SECRET, ADMIN_URL (opcional).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface Booking {
  reference: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedAt: string;
  status: string;
  notes?: string;
  areaPreference?: string;
}
interface Payload {
  alertId: string;
  kind: 'new' | 'reminder';
  alertStatus: string;
  reservation: Booking;
  isToday: boolean;
  minutesUntil: number;
  pendingCount: number;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REMINDER_FROM = Deno.env.get('REMINDER_FROM') ?? 'Costa Mar <onboarding@resend.dev>';
const ALERT_TO = (Deno.env.get('DIGEST_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const ADMIN_URL = Deno.env.get('ADMIN_URL') ?? 'https://admin.restaurantecostamar.cl';
const BUSINESS_NAME = 'Costa Mar Barra Cevichera';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
/** Para el asunto: una sola línea, sin saltos que puedan romper el encabezado. */
const oneLine = (v: unknown) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false });
const dayHhmm = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
const fullWhen = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
  });
const people = (n: number) => `${n} ${n === 1 ? 'persona' : 'personas'}`;

function untilLabel(minutes: number): string {
  if (minutes < 60) return `faltan ${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `faltan ${h} h ${m} min` : `faltan ${h} h`;
}

function subject(p: Payload): string {
  const b = p.reservation;
  const when = p.isToday ? `HOY ${hhmm(b.reservedAt)}` : dayHhmm(b.reservedAt);
  const core = `${when} · ${people(b.partySize)} · ${oneLine(b.customerName)}`;
  return p.kind === 'reminder' ? `Sigue sin confirmar: ${core}` : p.isToday ? core : `Nueva reserva: ${core}`;
}

function whatsappLink(b: Booking): string {
  const text =
    `Hola ${oneLine(b.customerName).split(' ')[0]}, te saluda ${BUSINESS_NAME}. Recibimos tu solicitud de reserva para el ` +
    `${fullWhen(b.reservedAt)} para ${people(b.partySize)} (referencia ${b.reference}). ` +
    `Estamos revisando la disponibilidad y te confirmamos en breve. ¿Sigue vigente?`;
  return `https://wa.me/${b.customerPhone.replace('+', '')}?text=${encodeURIComponent(text)}`;
}

function html(p: Payload): string {
  const b = p.reservation;
  const urgent = p.isToday
    ? `<p style="background:#fff2d8;color:#8a5d00;padding:12px;border-radius:10px;font-size:14px;margin:0 0 16px;"><strong>Es para hoy a las ${esc(hhmm(b.reservedAt))}</strong> (${esc(untilLabel(p.minutesUntil))}).</p>`
    : '';
  const reminder = p.kind === 'reminder'
    ? `<p style="background:#ffe9e4;color:#983a2d;padding:12px;border-radius:10px;font-size:14px;margin:0 0 16px;">Esta solicitud llegó hace más de 1 hora y <strong>sigue sin confirmar</strong>.</p>`
    : '';
  const others = p.pendingCount > 1
    ? `<p style="font-size:13px;color:#5a7382;margin:16px 0 0;">En total hay ${esc(p.pendingCount)} solicitudes por confirmar.</p>`
    : '';
  const notes = b.notes
    ? `<tr><td style="padding:6px 0;color:#5a7382;">Comentario</td><td style="padding:6px 0;">“${esc(b.notes)}”</td></tr>`
    : '';
  return `<!doctype html><html lang="es"><body style="margin:0;background:#faf7f1;font-family:Lato,Segoe UI,system-ui,sans-serif;color:#17324d;">
  <div style="max-width:520px;margin:0 auto;padding:24px 20px;">
    <h1 style="font-family:Georgia,serif;color:#1263a0;font-size:22px;margin:0 0 14px;">${p.kind === 'reminder' ? 'Reserva sin confirmar' : 'Nueva solicitud de reserva'}</h1>
    ${reminder}${urgent}
    <div style="background:#fff;border:1px solid #d8dedb;border-radius:12px;padding:16px 18px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:15px;">
        <tr><td style="padding:6px 0;color:#5a7382;width:110px;">Cliente</td><td style="padding:6px 0;"><strong>${esc(b.customerName)}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#5a7382;">Cuándo</td><td style="padding:6px 0;"><strong>${esc(fullWhen(b.reservedAt))}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#5a7382;">Personas</td><td style="padding:6px 0;">${esc(b.partySize)}</td></tr>
        <tr><td style="padding:6px 0;color:#5a7382;">Teléfono</td><td style="padding:6px 0;">${esc(b.customerPhone)}</td></tr>
        <tr><td style="padding:6px 0;color:#5a7382;">Referencia</td><td style="padding:6px 0;">${esc(b.reference)}</td></tr>
        ${notes}
      </table>
    </div>
    <p style="margin:20px 0 0;">
      <a href="${esc(whatsappLink(b))}" style="display:inline-block;background:#25d366;color:#0b3021;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;margin:0 8px 8px 0;">Contactar por WhatsApp</a>
      <a href="${esc(ADMIN_URL)}/reservas" style="display:inline-block;background:#ef8a42;color:#172e38;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;margin:0 0 8px 0;">Abrir en el panel</a>
    </p>
    ${others}
    <p style="font-size:12px;color:#5a7382;margin-top:18px;">Revisa también las mesas ocupadas en Fudo antes de confirmar.</p>
  </div></body></html>`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (!CRON_SECRET || (req.headers.get('Authorization') ?? '') !== `Bearer ${CRON_SECRET}`) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY not set' }, 500);
  if (!ALERT_TO.length) return json({ error: 'DIGEST_TO not set' }, 500);

  const body = await req.json().catch(() => ({}));
  const alertId = typeof body?.alertId === 'string' ? body.alertId : '';
  if (!/^[0-9a-f-]{36}$/i.test(alertId)) return json({ error: 'alertId required' }, 400);

  const { data, error } = await admin.rpc('reservation_alert_payload', { p_alert: alertId });
  if (error) return json({ error: error.message }, 500);
  const payload = data as Payload | null;
  if (!payload) return json({ sent: false, reason: 'alert not found' }, 404);
  if (payload.alertStatus !== 'pending') return json({ sent: false, reason: 'already processed' });

  // Ya la gestionó el equipo (confirmada, cancelada...): no tiene sentido avisar.
  if (payload.reservation.status !== 'pending') {
    await admin.rpc('reservation_alert_mark', { p_alert: alertId, p_status: 'skipped', p_detail: 'ya gestionada: ' + payload.reservation.status });
    return json({ sent: false, reason: 'already handled' });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMINDER_FROM, to: ALERT_TO, subject: subject(payload), html: html(payload) }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const detail = `resend:${res.status}:${text}`.slice(0, 500);
    await admin.rpc('reservation_alert_mark', { p_alert: alertId, p_status: 'failed', p_detail: detail });
    return json({ sent: false, error: detail }, 502);
  }
  await admin.rpc('reservation_alert_mark', { p_alert: alertId, p_status: 'sent', p_detail: 'resend:accepted' });
  return json({ sent: true, kind: payload.kind, subject: subject(payload) });
});
