import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "crypto";
import type { RadarProfile, RadarSource } from "@costamar/shared";
import { SupabaseService } from "../supabase/supabase.service";
import {
  MercadoPublicoClient,
  RadarUpstreamError,
} from "./mercado-publico.client";
import {
  fingerprint,
  keywordMatch,
  matchProfiles,
  normalizeAgil,
  normalizeLicitacion,
  validCode,
} from "./radar.normalize";
import { RadarEmailService } from "./radar.email";
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
@Injectable()
export class RadarSync {
  private busy = false;
  constructor(
    private readonly db: SupabaseService,
    private readonly upstream: MercadoPublicoClient,
    private readonly config: ConfigService,
    private readonly email: RadarEmailService,
  ) {}
  private check<T>(r: { data: T; error: any }): T {
    if (r.error)
      throw new RadarUpstreamError(
        "No pudimos persistir la sincronización de Radar.",
        300,
      );
    return r.data;
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    const owner = randomUUID();
    let claimed = false;
    try {
      claimed = !!this.check(
        await this.db.client.rpc("radar_claim", {
          p_owner: owner,
          p_interval: Math.max(
            60,
            Number(this.config.get("RADAR_INTERVAL_SECONDS")) || 900,
          ),
        }),
      );
      if (!claimed) return;
      if (!this.upstream.configured())
        throw new RadarUpstreamError(
          "Falta configurar el ticket de Mercado Público.",
          3600,
        );
      const deadline = Date.now() + 8 * 60000;
      const profiles = this.check(
        await this.db.client
          .from("radar_profiles")
          .select("*")
          .eq("enabled", true),
      ) as RadarProfile[];
      const known: any[] = [];
      for (let page = 0; page < 50; page++) {
        const rows = this.check(
          await this.db.client
            .from("radar_opportunities")
            .select("source,code,checked_at,favorite,official_status,stage")
            .order("id")
            .range(page * 1000, page * 1000 + 999),
        );
        known.push(...(rows ?? []));
        if ((rows ?? []).length < 1000) break;
        if (page === 49)
          throw new RadarUpstreamError(
            "El historial requiere ajustar el tamaño de sincronización.",
            3600,
          );
      }
      const knownCodes = new Set(
        (known ?? []).map((x) => `${x.source}:${x.code}`),
      );
      // Rebootstrap after a profile change, so newly added terms can discover older active processes.
      const cursors = this.check(
        await this.db.client.from("radar_cursors").select("*"),
      );
      const scopes = [...new Set(profiles.flatMap((p) => p.regions))];
      for (const region of scopes) {
        if (Date.now() > deadline - 120000) break;
        const scope = `compra_agil:${region}`,
          old = (cursors ?? []).find((x) => x.scope === scope);
        const profileRevision = hash(
          profiles
            .filter((p) => p.regions.includes(region))
            .map((p) => [p.id, p.updated_at]),
        );
        const changed = old && old.profile_revision !== profileRevision;
        const reconcile =
          old?.bootstrapped_at &&
          Date.now() - new Date(old.bootstrapped_at).getTime() > 86400000 &&
          old.mode === "changes" &&
          !old.window_end;
        let cursor =
          changed || reconcile || !old
            ? {
                scope,
                mode: "bootstrap",
                next_page: 1,
                window_start: null,
                window_end: new Date().toISOString(),
                completed_at: null,
                bootstrapped_at: old?.bootstrapped_at ?? null,
                profile_revision: profileRevision,
              }
            : old;
        if (cursor.mode === "changes" && !cursor.window_end)
          cursor = {
            ...cursor,
            window_start: new Date(
              new Date(cursor.completed_at).getTime() - 5 * 60000,
            ).toISOString(),
            window_end: new Date().toISOString(),
            next_page: 1,
          };
        this.check(
          await this.db.client
            .from("radar_cursors")
            .upsert({ ...cursor, updated_at: new Date().toISOString() }),
        );
        for (
          let pages = 0;
          pages < 4 && Date.now() < deadline - 120000;
          pages++
        ) {
          const params: Record<string, string> = {
            region: String(region),
            numero_pagina: String(cursor.next_page),
            tamano_pagina: "50",
            ordenar_por: "FechaUltimaModificacion",
          };
          if (cursor.mode === "bootstrap") {
            params.estado = "publicada";
            params.publicado_hasta = cursor.window_end;
          } else {
            params.cambio_desde = cursor.window_start;
            params.cambio_hasta = cursor.window_end;
          }
          const payload = await this.upstream.agilePage(owner, params);
          const relevant = payload.items.filter(
            (x: any) =>
              knownCodes.has(`compra_agil:${x.codigo}`) ||
              profiles.some(
                (p) =>
                  p.regions.includes(region) &&
                  keywordMatch(`${x.nombre ?? ""} ${x.descripcion ?? ""}`, p),
              ),
          );
          await this.enqueue(owner, "compra_agil", relevant);
          const done = cursor.next_page >= payload.paginacion.total_paginas;
          cursor = {
            ...cursor,
            bootstrapped_at:
              done && cursor.mode === "bootstrap"
                ? cursor.window_end
                : cursor.bootstrapped_at,
            next_page: done ? 1 : cursor.next_page + 1,
            mode: done ? "changes" : cursor.mode,
            completed_at: done ? cursor.window_end : cursor.completed_at,
            window_start: done ? null : cursor.window_start,
            window_end: done ? null : cursor.window_end,
          };
          this.check(
            await this.db.client
              .from("radar_cursors")
              .upsert({ ...cursor, updated_at: new Date().toISOString() }),
          );
          if (done) break;
        }
      }
      if (
        profiles.some((p) => p.include_licitaciones) &&
        Date.now() < deadline - 90000
      ) {
        const active = await this.upstream.activeLicitaciones(owner);
        const relevant = active.filter(
          (x: any) =>
            knownCodes.has(`licitacion:${x.CodigoExterno}`) ||
            profiles.some(
              (p) => p.include_licitaciones && keywordMatch(x.Nombre ?? "", p),
            ),
        );
        await this.enqueue(owner, "licitacion", relevant);
        this.check(
          await this.db.client
            .from("radar_cursors")
            .upsert({
              scope: "licitacion",
              mode: "active",
              next_page: 1,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }),
        );
      }
      // Tracked closed/removed processes still receive a direct detail refresh.
      for (const row of known ?? []) {
        if (
          (row.favorite ||
            row.official_status === "publicada" ||
            ["Postulada", "Cotizando"].includes(row.stage)) &&
          Date.now() - new Date(row.checked_at).getTime() > 3600000
        ) {
          await this.enqueue(owner, row.source as RadarSource, [
            row.source === "compra_agil"
              ? { codigo: row.code, refresh: true }
              : { CodigoExterno: row.code, refresh: true },
          ]);
        }
      }
      const pending = this.check(
        await this.db.client.rpc("radar_pending_candidates", { p_limit: 60 }),
      );
      let warning: string | null = null;
      for (const candidate of pending) {
        if (Date.now() > deadline - 60000) break;
        try {
          const raw = await this.upstream.detail(
            owner,
            candidate.source,
            candidate.code,
          );
          const row =
            candidate.source === "compra_agil"
              ? normalizeAgil(raw)
              : normalizeLicitacion(raw);
          if (row.code !== candidate.code) throw new Error("RADAR_SCHEMA");
          row.profile_ids = matchProfiles(row, profiles);
          // Keep tracked records even when new exclusions disqualify them. Discard irrelevant national candidates.
          if (
            row.profile_ids.length ||
            knownCodes.has(`${row.source}:${row.code}`)
          )
            this.check(
              await this.db.client.rpc("radar_ingest", {
                p_owner: owner,
                p_data: row,
                p_raw: raw,
                p_fingerprint: fingerprint(row),
              }),
            );
          this.check(
            await this.db.client
              .from("radar_candidates")
              .update({
                fetched_revision: candidate.revision,
                fetched_at: new Date().toISOString(),
                failures: 0,
              })
              .eq("source", candidate.source)
              .eq("code", candidate.code)
              .eq("revision", candidate.revision),
          );
        } catch (error) {
          if (error instanceof RadarUpstreamError && !error.recordMissing)
            throw error;
          this.check(
            await this.db.client
              .from("radar_candidates")
              .update({
                failures: candidate.failures + 1,
                retry_at: new Date(Date.now() + 3600000).toISOString(),
              })
              .eq("source", candidate.source)
              .eq("code", candidate.code),
          );
          warning =
            "Una ficha oficial no está disponible o cambió de formato. Se conservó para revisión y reintento.";
        }
      }
      this.check(
        await this.db.client.rpc("radar_closing_alerts", { p_owner: owner }),
      );
      await this.email.flush();
      this.check(
        await this.db.client.rpc("radar_release", {
          p_owner: owner,
          p_error: warning,
        }),
      );
      claimed = false;
    } catch (error) {
      const safe =
        error instanceof RadarUpstreamError
          ? error
          : new RadarUpstreamError(
              "Radar no pudo completar la revisión. Conservamos los últimos datos.",
              300,
            );
      if (claimed)
        await this.db.client.rpc("radar_release", {
          p_owner: owner,
          p_error: safe.message,
          p_block_seconds: safe.pauseSeconds,
        });
      // Safe diagnostics only; never print the raw upstream exception or ticket.
      console.error(`[Radar] ${safe.message}`);
    } finally {
      this.busy = false;
    }
  }
  private async enqueue(owner: string, source: RadarSource, rows: any[]) {
    const candidates = rows.map((x) => ({
      source,
      code: source === "compra_agil" ? x.codigo : x.CodigoExterno,
      revision: hash(x),
      payload: x,
    }));
    if (candidates.some((x) => !validCode(source, x.code ?? "")))
      throw new RadarUpstreamError(
        "La lista oficial contiene un código no reconocido.",
        300,
      );
    for (let i = 0; i < candidates.length; i += 100)
      this.check(
        await this.db.client.rpc("radar_enqueue", {
          p_owner: owner,
          p_candidates: candidates.slice(i, i + 100),
        }),
      );
  }
}
