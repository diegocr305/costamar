import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash } from "crypto";
import { RADAR_REGIONS } from "@costamar/shared";
import type {
  RadarGeneralItem,
  RadarGeneralList,
  RadarProfile,
  RadarSource,
} from "@costamar/shared";
import { SupabaseService } from "../supabase/supabase.service";
import {
  MercadoPublicoClient,
  RadarUpstreamError,
} from "./mercado-publico.client";
import { RadarGeneralQueryDto } from "./radar.dto";
import { classifyOpportunity } from "./radar.match";
import {
  fingerprint,
  fold,
  normalizeAgil,
  normalizeLicitacion,
  validCode,
} from "./radar.normalize";
@Injectable()
export class RadarGeneralService {
  private readonly pending = new Map<
    string,
    Promise<{
      payload: any;
      checkedAt: string;
      stale: boolean;
      cached: boolean;
    }>
  >();
  constructor(
    private readonly db: SupabaseService,
    private readonly upstream: MercadoPublicoClient,
  ) {}
  private check<T>(r: { data: T; error: any }): T {
    if (r.error)
      throw new ServiceUnavailableException(
        "No pudimos consultar la vista general. Comprueba la migración.",
      );
    return r.data;
  }
  private async pause(error: unknown) {
    if (error instanceof RadarUpstreamError && error.pauseSeconds > 5)
      this.check(
        await this.db.client.rpc("radar_general_pause", {
          p_seconds: error.pauseSeconds,
          p_message: error.message,
        }),
      );
  }
  private async cached(
    key: string,
    refresh: boolean,
    load: () => Promise<any>,
  ) {
    const cache = this.check(
      await this.db.client
        .from("radar_general_cache")
        .select("payload,checked_at")
        .eq("cache_key", key)
        .maybeSingle(),
    );
    if (
      cache &&
      !refresh &&
      Date.now() - Date.parse(cache.checked_at) < 15 * 60000
    )
      return {
        payload: cache.payload,
        checkedAt: cache.checked_at,
        stale: false,
        cached: true,
      };
    const existing = this.pending.get(key);
    if (existing) return existing;
    const work = (async () => {
      try {
        const payload = await load(),
          checkedAt = new Date().toISOString();
        this.check(
          await this.db.client
            .from("radar_general_cache")
            .upsert({ cache_key: key, payload, checked_at: checkedAt }),
        );
        return { payload, checkedAt, stale: false, cached: false };
      } catch (error) {
        await this.pause(error);
        if (cache)
          return {
            payload: cache.payload,
            checkedAt: cache.checked_at,
            stale: true,
            cached: true,
          };
        throw new ServiceUnavailableException(
          error instanceof RadarUpstreamError
            ? error.message
            : "No pudimos obtener el listado oficial. Inténtalo de nuevo.",
        );
      }
    })();
    this.pending.set(key, work);
    try {
      return await work;
    } finally {
      this.pending.delete(key);
    }
  }
  async list(dto: RadarGeneralQueryDto): Promise<RadarGeneralList> {
    if (dto.source === "licitacion" && dto.region !== undefined)
      throw new BadRequestException(
        "El listado básico de licitaciones tiene alcance nacional; la región se revisa en la ficha.",
      );
    const page = dto.page ?? 1,
      pageSize = 50,
      q = dto.q?.trim() ?? "";
    if (dto.source === "licitacion") {
      const response = await this.cached(
        "licitacion:active",
        dto.refresh === "true",
        () => this.upstream.activeLicitaciones(null),
      );
      const filtered = response.payload.filter(
        (x: any) =>
          Number(x.CodigoEstado) === 5 &&
          (!q || fold(`${x.CodigoExterno} ${x.Nombre}`).includes(fold(q))),
      );
      const items = filtered
        .slice((page - 1) * pageSize, page * pageSize)
        .map(
          (x: any): RadarGeneralItem => ({
            source: "licitacion",
            code: x.CodigoExterno,
            name: x.Nombre,
            buyer: "No informado en listado básico",
            region: null,
            budget: null,
            currency: "",
            closes_raw: x.FechaCierre ?? "",
            official_status: "publicada",
          }),
        );
      return {
        checkedAt: response.checkedAt,
        stale: response.stale,
        cached: response.cached,
        items,
        total: filtered.length,
        page,
        pageSize,
        totalPages: Math.ceil(filtered.length / pageSize),
        scope: "Licitaciones publicadas · Todo Chile",
      };
    }
    const key =
      "compra_agil:" +
      createHash("sha256")
        .update(JSON.stringify({ page, region: dto.region ?? null, q }))
        .digest("hex");
    const params: Record<string, string> = {
      estado: "publicada",
      tamano_pagina: String(pageSize),
      numero_pagina: String(page),
      ordenar_por: "FechaPublicacion",
    };
    if (dto.region !== undefined) params.region = String(dto.region);
    if (q) params.q = q;
    const response = await this.cached(key, dto.refresh === "true", () =>
      this.upstream.agilePage(null, params),
    );
    const p = response.payload;
    const items = p.items.map(
      (x: any): RadarGeneralItem => ({
        source: "compra_agil",
        code: x.codigo,
        name: x.nombre,
        buyer: x.institucion?.organismo_comprador ?? "",
        region: x.institucion?.region ?? null,
        budget: x.montos?.monto_disponible ?? null,
        currency: x.montos?.moneda ?? "",
        closes_raw: x.fechas?.fecha_cierre ?? "",
        official_status: x.estado?.codigo ?? "publicada",
      }),
    );
    if (items.some((x: RadarGeneralItem) => !validCode("compra_agil", x.code)))
      throw new ServiceUnavailableException(
        "La fuente devolvió códigos inesperados.",
      );
    return {
      items,
      total: p.paginacion.total_resultados,
      page,
      pageSize,
      totalPages: p.paginacion.total_paginas,
      checkedAt: response.checkedAt,
      stale: response.stale,
      cached: response.cached,
      scope:
        dto.region === undefined
          ? "Compras Ágiles publicadas · Todo Chile"
          : `Compras Ágiles publicadas · ${RADAR_REGIONS.find((x) => x.code === dto.region)?.name}`,
    };
  }
  async import(actor: string, source: RadarSource, code: string) {
    if (
      !["compra_agil", "licitacion"].includes(source) ||
      !validCode(source, code)
    )
      throw new BadRequestException("Revisa el código y procedimiento.");
    const existing = this.check(
      await this.db.client
        .from("radar_opportunities")
        .select("id")
        .eq("source", source)
        .eq("code", code)
        .maybeSingle(),
    );
    if (existing) {
      this.check(
        await this.db.client
          .from("radar_opportunities")
          .update({ manual_selected: true })
          .eq("id", existing.id),
      );
      return { id: existing.id };
    }
    let raw: any;
    try {
      raw = await this.upstream.detail(null, source, code);
    } catch (error) {
      await this.pause(error);
      throw new ServiceUnavailableException(
        error instanceof RadarUpstreamError
          ? error.message
          : "No pudimos consultar la ficha.",
      );
    }
    const row =
      source === "compra_agil" ? normalizeAgil(raw) : normalizeLicitacion(raw);
    if (row.code !== code)
      throw new ServiceUnavailableException(
        "El código de la ficha no coincide con el solicitado.",
      );
    const profiles = this.check(
      await this.db.client
        .from("radar_profiles")
        .select("*")
        .eq("enabled", true),
    ) as RadarProfile[];
    const data = { ...row, ...classifyOpportunity(row, profiles) };
    const input = {
      ...data,
      match_kind: data.profile_ids.length ? data.match_kind : "manual",
      match_reasons: data.profile_ids.length
        ? data.match_reasons
        : ["Seleccionada manualmente desde General diario."],
    };
    const id = this.check(
      await this.db.client.rpc("radar_import_general", {
        p_actor: actor,
        p_data: input,
        p_raw: raw,
        p_fingerprint: fingerprint(row),
      }),
    );
    return { id };
  }
}
