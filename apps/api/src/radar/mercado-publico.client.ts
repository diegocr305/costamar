import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { RadarSource } from "@costamar/shared";
import { SupabaseService } from "../supabase/supabase.service";
import { validCode } from "./radar.normalize";
export class RadarUpstreamError extends Error {
  constructor(
    message: string,
    readonly pauseSeconds = 0,
    readonly transient = false,
    readonly recordMissing = false,
  ) {
    super(message);
  }
}
export const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export function retrySeconds(value: string | null): number {
  if (!value) return 300;
  const number = Number(value);
  if (Number.isFinite(number))
    return Math.min(86400, Math.max(1, Math.ceil(number)));
  const time = Date.parse(value);
  return Number.isFinite(time)
    ? Math.min(86400, Math.max(1, Math.ceil((time - Date.now()) / 1000)))
    : 300;
}
@Injectable()
export class MercadoPublicoClient {
  constructor(
    private readonly config: ConfigService,
    private readonly db: SupabaseService,
  ) {}
  configured() {
    return !!this.config.get("MERCADO_PUBLICO_TICKET");
  }
  private async get(
    owner: string,
    path: string,
    params: Record<string, string>,
    v2: boolean,
  ): Promise<any> {
    const ticket = this.config.get<string>("MERCADO_PUBLICO_TICKET");
    if (!ticket)
      throw new RadarUpstreamError(
        "Falta configurar el ticket de Mercado Público.",
        3600,
      );
    const url = new URL(
      path,
      v2 ? "https://api2.mercadopublico.cl" : "https://api.mercadopublico.cl",
    );
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    if (!v2) url.searchParams.set("ticket", ticket);
    for (let attempt = 0; attempt < 3; attempt++) {
      const budget = await this.db.client.rpc("radar_consume_request", {
        p_owner: owner,
        p_limit: 9000,
      });
      if (budget.error)
        throw new RadarUpstreamError(
          "No pudimos registrar el consumo de consultas.",
          300,
        );
      if (!budget.data)
        throw new RadarUpstreamError(
          "Se pausó la consulta por el límite de consumo.",
          3600,
        );
      await wait(
        Math.min(
          60000,
          Math.max(
            1000,
            Number(this.config.get("RADAR_REQUEST_DELAY_MS")) || 5000,
          ),
        ),
      );
      try {
        const response = await fetch(url, {
          headers: v2 ? { ticket } : {},
          redirect: "error",
          signal: AbortSignal.timeout(35000),
        });
        if (response.status === 401 || response.status === 403)
          throw new RadarUpstreamError(
            "Mercado Público rechazó las credenciales. Revisa el ticket.",
            3600,
          );
        if (response.status === 429)
          throw new RadarUpstreamError(
            "Mercado Público limitó temporalmente las consultas. Se reanudarán después de la pausa.",
            retrySeconds(response.headers.get("retry-after")),
          );
        if (response.status === 404)
          throw new RadarUpstreamError(
            "La ficha oficial no está disponible.",
            0,
            false,
            true,
          );
        if (response.status >= 500)
          throw new RadarUpstreamError(
            "Mercado Público no responde temporalmente.",
            0,
            true,
          );
        if (!response.ok)
          throw new RadarUpstreamError(
            `Mercado Público rechazó una consulta (HTTP ${response.status}).`,
            300,
          );
        if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024)
          throw new RadarUpstreamError(
            "La respuesta oficial superó el tamaño permitido.",
            300,
          );
        const text = await response.text();
        if (text.length > 20 * 1024 * 1024)
          throw new RadarUpstreamError(
            "La respuesta oficial superó el tamaño permitido.",
            300,
          );
        let data: any;
        try {
          data = JSON.parse(text.replaceAll(ticket, "[REDACTED]"));
        } catch {
          throw new RadarUpstreamError(
            "Mercado Público devolvió una respuesta inválida.",
            0,
            true,
          );
        }
        if (v2 && data.success !== "OK" && data.success !== true)
          throw new RadarUpstreamError(
            "Compra Ágil no confirmó el éxito de la consulta.",
            300,
          );
        if (!v2 && (data.Codigo !== undefined || !Array.isArray(data.Listado)))
          throw new RadarUpstreamError(
            "Licitaciones devolvió un error o formato inesperado.",
            300,
          );
        return data;
      } catch (error) {
        // Do not propagate native fetch errors: they may contain v1's secret query URL.
        const safe =
          error instanceof RadarUpstreamError
            ? error
            : new RadarUpstreamError(
                "No pudimos conectar con Mercado Público usando TLS válido.",
                0,
                true,
              );
        if (!safe.transient || attempt === 2) throw safe;
        await wait(1000 * 2 ** attempt);
      }
    }
    throw new RadarUpstreamError("Mercado Público no respondió.", 300);
  }
  async agilePage(owner: string, params: Record<string, string>) {
    const data = await this.get(owner, "/v2/compra-agil", params, true),
      p = data.payload;
    if (
      !Array.isArray(p?.items) ||
      !p?.paginacion ||
      !Number.isInteger(p.paginacion.total_paginas) ||
      p.paginacion.total_paginas < 0
    )
      throw new RadarUpstreamError(
        "Compra Ágil cambió el formato de paginación.",
        300,
      );
    return p;
  }
  async activeLicitaciones(owner: string) {
    return (
      await this.get(
        owner,
        "/servicios/v1/publico/licitaciones.json",
        { estado: "activas" },
        false,
      )
    ).Listado;
  }
  async detail(owner: string, source: RadarSource, code: string) {
    if (!validCode(source, code))
      throw new RadarUpstreamError(
        "El código de proceso no tiene un formato admitido.",
      );
    if (source === "compra_agil")
      return (await this.get(owner, `/v2/compra-agil/${code}`, {}, true))
        .payload;
    const data = await this.get(
      owner,
      "/servicios/v1/publico/licitaciones.json",
      { codigo: code },
      false,
    );
    if (data.Listado.length !== 1)
      throw new RadarUpstreamError(
        "La ficha solicitada no está disponible.",
        0,
        false,
        true,
      );
    return data.Listado[0];
  }
}
