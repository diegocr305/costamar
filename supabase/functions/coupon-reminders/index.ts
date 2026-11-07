// ============================================================
// Edge Function: coupon-reminders
// Envía por correo (Resend) el aviso de cupones del Club que vencen
// dentro de 7 días, a los socios que dieron consentimiento de email.
//
// La selección y el marcado viven en RPCs de Postgres (security definer).
// Esta función solo:
//   1) refresca la cola         -> club_prepare_coupon_reminders(7)
//   2) toma los pendientes      -> club_pending_email_reminders(limit)
//   3) envía cada email         -> Resend API
//   4) cierra cada recordatorio -> club_mark_email_reminder(id, status, detail)
//
// WhatsApp NO se envía aquí: queda en cola para el panel admin (wa.me).
//
// Seguridad:
//   - Requiere header Authorization: Bearer <CRON_SECRET> (lo inyecta el cron).
//   - Usa SERVICE_ROLE_KEY solo dentro de la función (nunca sale al cliente).
//
// Secrets requeridos (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (inyectados por la plataforma)
//   RESEND_API_KEY        -> clave de Resend (re_...)
//   REMINDER_FROM         -> "Costa Mar <club@restaurantecostamar.cl>"
//   CRON_SECRET           -> mismo valor que app.settings.edge_cron_secret
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

interface PendingEmail {
  reminder_id: string;
  coupon_id: string;
  code: string;
  expires_at: string;
  full_name: string;
  email: string | null;
  campaign_name: string;
  benefit: string | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REMINDER_FROM = Deno.env.get('REMINDER_FROM') ?? 'Costa Mar <club@restaurantecostamar.cl>';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const CLUB_URL = Deno.env.get('CLUB_URL') ?? 'https://club.restaurantecostamar.cl';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Fecha de vencimiento legible en español de Chile. */
function expiryLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
    day: 'numeric',
    month: 'long',
  });
}

/** Días que faltan para el vencimiento (zona Chile, redondeado hacia arriba). */
function daysLeft(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );
}

function emailHtml(row: PendingEmail): string {
  const firstName = escapeHtml(row.full_name.split(' ')[0] || 'socio');
  const benefit = row.benefit ? escapeHtml(row.benefit) : escapeHtml(row.campaign_name);
  const when = escapeHtml(expiryLabel(row.expires_at));
  const left = daysLeft(row.expires_at);
  const leftLabel = left === 1 ? 'mañana' : `en ${left} días`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#faf7f1;font-family:'Lato',Segoe UI,system-ui,sans-serif;color:#17324d;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-family:Georgia,'Times New Roman',serif;color:#1263a0;font-size:24px;margin:0 0 8px;">Tu beneficio está por vencer</h1>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Hola ${firstName}, te saluda el Club Costa Mar.</p>
    <div style="background:#ffffff;border:1px solid #d8dedb;border-radius:12px;padding:20px;margin:0 0 20px;">
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px;"><strong>${benefit}</strong></p>
      <p style="font-size:14px;line-height:1.6;margin:0;color:#5a7382;">Vence el ${when} (${leftLabel}). Aprovéchalo en tu próxima visita a Costa Mar Barra Cevichera, Quillota.</p>
    </div>
    <a href="${escapeHtml(CLUB_URL)}/cupones" style="display:inline-block;background:#ef8a42;color:#172e38;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Ver mi cupón</a>
    <p style="font-size:12px;line-height:1.6;color:#5a7382;margin:24px 0 0;">Recibes este correo porque autorizaste recibir novedades del Club. Puedes ajustar tus preferencias en tu perfil del Club.</p>
  </div></body></html>`;
}

async function sendEmail(row: PendingEmail): Promise<{ ok: boolean; detail: string }> {
  const left = daysLeft(row.expires_at);
  const subject = left === 1
    ? 'Tu beneficio del Club Costa Mar vence mañana'
    : `Tu beneficio del Club Costa Mar vence en ${left} días`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMINDER_FROM,
      to: [row.email],
      subject,
      html: emailHtml(row),
    }),
  });
  if (res.ok) return { ok: true, detail: 'resend:accepted' };
  const text = await res.text().catch(() => '');
  return { ok: false, detail: `resend:${res.status}:${text}`.slice(0, 500) };
}

Deno.serve(async (req) => {
  // Autorización del cron: Bearer CRON_SECRET.
  const auth = req.headers.get('Authorization') ?? '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1) Refresca la cola (idempotente).
  const prep = await admin.rpc('club_prepare_coupon_reminders', { p_days: 7 });
  if (prep.error) {
    return new Response(JSON.stringify({ error: prep.error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2) Toma los pendientes de email.
  const { data, error } = await admin.rpc('club_pending_email_reminders', { p_limit: 200 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = (data ?? []) as PendingEmail[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // 3+4) Envía y cierra cada recordatorio.
  for (const row of rows) {
    if (!row.email) {
      await admin.rpc('club_mark_email_reminder', {
        p_reminder_id: row.reminder_id,
        p_status: 'skipped',
        p_detail: 'sin correo en auth.users',
      });
      skipped++;
      continue;
    }
    const result = await sendEmail(row);
    await admin.rpc('club_mark_email_reminder', {
      p_reminder_id: row.reminder_id,
      p_status: result.ok ? 'sent' : 'failed',
      p_detail: result.detail,
    });
    if (result.ok) sent++;
    else failed++;
  }

  return new Response(JSON.stringify({ processed: rows.length, sent, failed, skipped }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
