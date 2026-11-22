// ============================================================
// Edge Function: club-emails
// Correos automáticos del Club con el cupón del socio (Resend):
//   * birthday -> saludo de cumpleaños con el cupón del mes
//   * welcome  -> bienvenida al Club con el regalo de fundadores
//
// La selección vive en Postgres (club_prepare_member_emails / club_pending_member_emails).
// Esta función envía y cierra cada correo con club_mark_member_email.
//
// Body JSON: { kind?: 'birthday' | 'welcome', preview?: boolean }
//   preview=true -> envía UNA muestra de cada tipo a DIGEST_TO y no marca nada.
//
// Secrets: RESEND_API_KEY, REMINDER_FROM, CRON_SECRET, CLUB_URL, DIGEST_TO.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Kind = 'birthday' | 'welcome';
interface PendingEmail {
  email_id: string;
  kind: Kind;
  code: string;
  expires_at: string | null;
  full_name: string;
  member_code: string | null;
  email: string | null;
  campaign_name: string;
  benefit: string | null;
  options: string[] | null;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REMINDER_FROM = Deno.env.get('REMINDER_FROM') ?? 'Costa Mar <club@restaurantecostamar.cl>';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const CLUB_URL = Deno.env.get('CLUB_URL') ?? 'https://club.restaurantecostamar.cl';
const TEST_RECIPIENTS = (Deno.env.get('DIGEST_TO') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
// Con el remitente de pruebas de Resend solo se puede entregar al dueño de la cuenta.
const TEST_SENDER = REMINDER_FROM.toLowerCase().includes('@resend.dev');

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/** Último día válido: el cupón vence a las 00:00 del día siguiente (hora de Chile). */
function lastValidDay(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(new Date(iso).getTime() - 1000).toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago', day: 'numeric', month: 'long',
  });
}


const LOGO_URL = Deno.env.get('LOGO_URL') ?? 'https://restaurantecostamar.cl/assets/brand/costamar-logo.png';

interface Theme { boxBg: string; boxBorder: string; label: string; dash: string; }
const WELCOME_THEME: Theme = { boxBg: '#EFF8F7', boxBorder: '#B9DCD9', label: '#36636B', dash: '#81ADAE' };
const BIRTHDAY_THEME: Theme = { boxBg: '#FFF5E8', boxBorder: '#EBCDA6', label: '#805122', dash: '#C69D6B' };

interface EmailParts {
  title: string; preheader: string; heading: string; intro: string;
  boxLabel: string; benefitTitle: string; benefitText: string;
  until: string | null; memberCode: string | null; button: string; theme: Theme;
}

/** Plantilla común del Club (tablas, estilos en línea, compatible con Outlook). Valores ya escapados. */
function template(e: EmailParts): string {
  const t = e.theme;
  const until = e.until
    ? `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;"><strong>Hasta el ${e.until}</strong> · Válido con consumo en el local.</p>`
    : `<p style="margin:14px 0 0;font-size:14px;line-height:1.5;">Válido con consumo en el local.</p>`;
  const code = e.memberCode
    ? `<tr><td style="padding:14px 20px;border-top:1px dashed ${t.dash};">
        <p style="margin:0 0 4px;color:${t.label};font-size:13px;">Tu código de socio</p>
        <strong style="font:bold 20px/1.4 'Courier New',monospace;letter-spacing:2px;">${e.memberCode}</strong>
      </td></tr>`
    : '';
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e.title}</title></head>
<body style="margin:0;padding:0;background-color:#F7F4EE;color:#193D48;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${e.preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F7F4EE">
    <tr><td align="center" style="padding:20px 12px;">
      <!--[if mso]><table role="presentation" width="540" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:540px;border-top:5px solid #70C2C0;">
        <tr><td align="center" style="padding:20px;">
          <img src="${escapeHtml(LOGO_URL)}" width="92" alt="Costa Mar Barra Cevichera" style="display:block;width:92px;height:auto;border:0;">
        </td></tr>
        <tr><td bgcolor="#193D48" style="padding:28px 24px;color:#FFFFFF;">
          <p style="margin:0 0 10px;color:#A6DEDB;font-size:12px;font-weight:bold;letter-spacing:1.5px;">CLUB COSTA MAR</p>
          <h1 style="margin:0;font:normal 32px/1.15 Georgia,'Times New Roman',serif;">${e.heading}</h1>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.55;">${e.intro}</p>
        </td></tr>
        <tr><td style="padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${t.boxBg}" style="border:1px solid ${t.boxBorder};border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 7px;color:${t.label};font-size:14px;">${e.boxLabel}</p>
              <h2 style="margin:0 0 8px;color:#193D48;font:bold 25px/1.2 Georgia,'Times New Roman',serif;">${e.benefitTitle}</h2>
              <p style="margin:0;font-size:16px;line-height:1.5;">${e.benefitText}</p>
              ${until}
            </td></tr>
            ${code}
          </table>
          <p style="margin:20px 0 12px;font-size:15px;line-height:1.55;">Al hacer tu pedido, abre el cupón y muéstraselo a quien te atienda.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td align="center" bgcolor="#E08316" style="border-radius:8px;">
              <a href="${escapeHtml(CLUB_URL)}/cupones" style="display:block;color:#172E38;font:bold 16px/48px Arial,Helvetica,sans-serif;text-decoration:none;">${e.button}</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:18px 24px;border-top:1px solid #DBE7E6;color:#4C6267;font-size:12px;line-height:1.6;">
          <strong>Costa Mar Barra Cevichera · Quillota</strong><br>
          Recibes este correo porque autorizaste recibir novedades del Club. Puedes cambiar tus preferencias en tu perfil del Club.
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

/** "jugo individual" -> "jugo"; lista en español: "a, b o c". */
function optionsSentence(options: string[]): string {
  const clean = options.map((o) => String(o).replace(/\s+individual$/i, '').trim()).filter(Boolean);
  if (clean.length <= 1) return clean.join('');
  return `${clean.slice(0, -1).join(', ')} o ${clean[clean.length - 1]}`;
}

function render(row: PendingEmail): { subject: string; html: string } {
  const rawFirst = row.full_name.trim().split(/\s+/)[0] || 'socio';
  const name = escapeHtml(rawFirst);
  const until = lastValidDay(row.expires_at);
  const untilHtml = until ? escapeHtml(until) : null;
  const memberCode = row.member_code ? escapeHtml(row.member_code) : null;
  const benefit = row.benefit ?? row.campaign_name;

  if (row.kind === 'birthday') {
    const subject = `¡Feliz cumpleaños, ${rawFirst}! Tu regalo te espera en Costa Mar`;
    return {
      subject,
      html: template({
        title: escapeHtml(subject),
        preheader: `Celebra con tu Barco Cumpleañero. Tienes ${escapeHtml(benefit)} de regalo${untilHtml ? ` hasta el ${untilHtml}` : ''}.`,
        heading: `¡Feliz cumpleaños, ${name}!`,
        intro: 'Este mes queremos celebrar contigo. Cuando vengas a Costa Mar, deja un espacio para el postre.',
        boxLabel: 'Tu regalo de cumpleaños',
        benefitTitle: 'Barco Cumpleañero',
        benefitText: `Un regalo personal para ti, con <strong>${escapeHtml(benefit)}.</strong>`,
        until: untilHtml, memberCode, button: 'Ver mi cupón de cumpleaños', theme: BIRTHDAY_THEME,
      }),
    };
  }

  const options = Array.isArray(row.options) ? optionsSentence(row.options) : '';
  const subject = 'Tu regalo de bienvenida al Club Costa Mar';
  return {
    subject,
    html: template({
      title: escapeHtml(subject),
      preheader: options
        ? `${name}, elige ${escapeHtml(options)} de regalo en tu próxima visita.`
        : `${name}, tu regalo de bienvenida te espera en tu próxima visita.`,
      heading: `¡Bienvenido a la mesa, ${name}!`,
      intro: 'Gracias por ser socio fundador. En tu próxima visita, el primer brindis va por nuestra cuenta.',
      boxLabel: 'Tu regalo de bienvenida',
      benefitTitle: escapeHtml(benefit.replace(/\s+de regalo$/i, '')),
      benefitText: options
        ? `Elige ${escapeHtml(options)}, todos en formato individual.`
        : escapeHtml(row.campaign_name),
      until: untilHtml, memberCode, button: 'Ver mi cupón', theme: WELCOME_THEME,
    }),
  };
}

const isRetryable = (status: number) => status === 401 || status === 403 || status === 429 || status >= 500;

async function send(to: string[], row: PendingEmail): Promise<{ ok: boolean; retryable: boolean; detail: string }> {
  const { subject, html } = render(row);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: REMINDER_FROM, to, subject, html }),
  });
  if (res.ok) return { ok: true, retryable: false, detail: 'resend:accepted' };
  const text = await res.text().catch(() => '');
  return { ok: false, retryable: isRetryable(res.status), detail: `resend:${res.status}:${text}`.slice(0, 500) };
}

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) return json({ error: 'unauthorized' }, 401);
  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY not set' }, 500);

  const body = await req.json().catch(() => ({}));
  const kind: Kind | null = body?.kind === 'birthday' || body?.kind === 'welcome' ? body.kind : null;
  const preview = body?.preview === true;

  const prep = await admin.rpc('club_prepare_member_emails', { p_kind: kind });
  if (prep.error) return json({ error: prep.error.message }, 500);
  const { data, error } = await admin.rpc('club_pending_member_emails', { p_kind: kind, p_limit: 100 });
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as PendingEmail[];

  if (preview) {
    if (!TEST_RECIPIENTS.length) return json({ error: 'DIGEST_TO not set' }, 500);
    const samples = (['birthday', 'welcome'] as Kind[])
      .map((k) => rows.find((r) => r.kind === k))
      .filter((r): r is PendingEmail => !!r);
    const results = [];
    for (const row of samples) {
      const r = await send(TEST_RECIPIENTS, row);
      results.push({ kind: row.kind, ok: r.ok, detail: r.detail });
      await sleep(600);
    }
    return json({ preview: true, pending: rows.length, results });
  }

  let sent = 0, failed = 0, skipped = 0, held = 0;
  for (const row of rows) {
    if (!row.email) {
      await admin.rpc('club_mark_member_email', { p_email_id: row.email_id, p_status: 'skipped', p_detail: 'sin correo' });
      skipped++;
      continue;
    }
    if (TEST_SENDER && !TEST_RECIPIENTS.map((s) => s.toLowerCase()).includes(row.email.toLowerCase())) { held++; continue; }
    const r = await send([row.email], row);
    if (!r.ok && r.retryable) { held++; await sleep(1500); continue; }
    await admin.rpc('club_mark_member_email', { p_email_id: row.email_id, p_status: r.ok ? 'sent' : 'failed', p_detail: r.detail });
    if (r.ok) sent++; else failed++;
    await sleep(600); // Resend: máximo 2 solicitudes por segundo.
  }
  return json({ processed: rows.length, sent, failed, skipped, held, testMode: TEST_SENDER });
});
