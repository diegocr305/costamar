import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import { emailConfiguration } from "./radar.service";
@Injectable()
export class RadarEmailService {
  constructor(
    private readonly config: ConfigService,
    private readonly db: SupabaseService,
  ) {}
  async flush() {
    const settings = emailConfiguration(this.config);
    if (!settings.ready || !settings.enabled) return;
    const result = await this.db.client
      .from("radar_alerts")
      .select("*")
      .in("email_state", ["pending", "sending", "failed"])
      .lte("email_next_at", new Date().toISOString())
      .order("created_at")
      .limit(10);
    if (result.error) throw new Error("RADAR_EMAIL_DB");
    for (const alert of result.data ?? []) {
      // Provider idempotency lasts 24h. Ambiguous delivery beyond 23h requires review, never a blind resend.
      if (
        alert.email_first_attempt_at &&
        Date.now() - new Date(alert.email_first_attempt_at).getTime() >
          23 * 3600000
      ) {
        await this.db.client
          .from("radar_alerts")
          .update({
            email_state: "review",
            email_error: "Verificar entrega antes de reenviar.",
          })
          .eq("id", alert.id);
        continue;
      }
      if (
        !alert.email_first_attempt_at &&
        Date.now() - new Date(alert.created_at).getTime() > 86400000
      ) {
        await this.db.client
          .from("radar_alerts")
          .update({
            email_state: "skipped",
            email_error: "Aviso antiguo: disponible dentro del panel.",
          })
          .eq("id", alert.id);
        continue;
      }
      const payload = alert.email_payload ?? {
        from: this.config.get<string>("RADAR_EMAIL_FROM"),
        to: settings.recipients,
        subject: `Costa Mar Radar · ${alert.title}`,
        text: `${alert.message}\n\nRevisa requisitos, lugar de entrega y fecha de cierre antes de cotizar.\nFuente: ChileCompra / Mercado Público.\nPanel: https://admin.restaurantecostamar.cl/radar?opportunity=${alert.opportunity_id}`,
      };
      const saved = await this.db.client
        .from("radar_alerts")
        .update({
          email_state: "sending",
          email_payload: payload,
          email_attempts: alert.email_attempts + 1,
          email_first_attempt_at:
            alert.email_first_attempt_at ?? new Date().toISOString(),
        })
        .eq("id", alert.id);
      if (saved.error) throw new Error("RADAR_EMAIL_DB");
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.get("RESEND_API_KEY")}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `radar/${alert.id}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
          redirect: "error",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { id?: string };
        if (!body.id) throw new Error("RESPONSE");
        const sent = await this.db.client
          .from("radar_alerts")
          .update({
            email_state: "sent",
            email_provider_id: body.id,
            email_error: null,
          })
          .eq("id", alert.id);
        if (sent.error) throw new Error("PERSIST");
      } catch {
        const failed = await this.db.client
          .from("radar_alerts")
          .update({
            email_state: "failed",
            email_error:
              "No se confirmó la entrega; se reintentará con el mismo identificador.",
            email_next_at: new Date(
              Date.now() +
                Math.min(
                  21600000,
                  300000 * 2 ** Math.min(alert.email_attempts, 6),
                ),
            ).toISOString(),
          })
          .eq("id", alert.id);
        if (failed.error) throw new Error("RADAR_EMAIL_DB");
        break;
      }
    }
  }
}
