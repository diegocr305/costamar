import { RadarGeneralService } from "./radar.general";
import { RadarGeneralQueryDto } from "./radar.dto";
import { SupabaseService } from "../supabase/supabase.service";
import {
  MercadoPublicoClient,
  RadarUpstreamError,
} from "./mercado-publico.client";
describe("General diario independiente del filtro gastronómico", () => {
  let service: RadarGeneralService,
    upstream: any,
    db: any,
    cache: Map<string, any>,
    existing: any;
  beforeEach(() => {
    cache = new Map();
    existing = null;
    db = {
      client: {
        rpc: jest.fn().mockResolvedValue({ data: "saved-id", error: null }),
        from: (table: string) => {
          let conditions: Record<string, any> = {},
            action = "",
            value: any;
          const result = () => ({
            error: null,
            data:
              table === "radar_general_cache"
                ? (cache.get(conditions.cache_key) ?? null)
                : table === "radar_opportunities"
                  ? existing
                  : table === "radar_profiles"
                    ? []
                    : null,
          });
          const q: any = {
            select: () => q,
            eq: (key: string, v: any) => {
              conditions[key] = v;
              return q;
            },
            maybeSingle: async () => result(),
            upsert: (v: any) => {
              cache.set(v.cache_key, v);
              return Promise.resolve({ error: null, data: null });
            },
            update: (v: any) => {
              action = "update";
              value = v;
              return q;
            },
            then: (resolve: any, reject: any) =>
              Promise.resolve(
                action === "update" ? { error: null, data: value } : result(),
              ).then(resolve, reject),
          };
          return q;
        },
      },
    };
    upstream = {
      activeLicitaciones: jest.fn().mockResolvedValue([
        {
          CodigoExterno: "999-1-L126",
          Nombre: "Compra de lápices",
          CodigoEstado: 5,
          FechaCierre: "2026-12-01T09:00:00",
        },
        { CodigoExterno: "999-2-L126", Nombre: "Colación", CodigoEstado: 6 },
      ]),
      agilePage: jest
        .fn()
        .mockResolvedValue({
          items: [
            {
              codigo: "999-1-COT26",
              nombre: "Equipos de oficina",
              estado: { codigo: "publicada" },
              institucion: { region: 13 },
              montos: { moneda: "CLP", monto_disponible: 1000 },
            },
          ],
          paginacion: { total_resultados: 501, total_paginas: 11 },
        }),
      detail: jest
        .fn()
        .mockResolvedValue({
          codigo: "999-1-COT26",
          nombre: "Solicitud sin comida",
          estado: { codigo: "publicada" },
          institucion: { region: 13 },
        }),
    };
    service = new RadarGeneralService(
      db as SupabaseService,
      upstream as MercadoPublicoClient,
    );
  });
  it("licitaciones muestra compras no alimenticias y solo estados publicados", async () => {
    const result = await service.list(
      Object.assign(new RadarGeneralQueryDto(), { source: "licitacion" }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe("Compra de lápices");
    expect(result.scope).toContain("Todo Chile");
    expect(upstream.activeLicitaciones).toHaveBeenCalledWith(null);
  });
  it("Compra Ágil nacional no hereda regiones, exclusiones o palabras del perfil", async () => {
    const result = await service.list(
      Object.assign(new RadarGeneralQueryDto(), { page: 2 }),
    );
    expect(result.items[0].name).toBe("Equipos de oficina");
    expect(result.totalPages).toBe(11);
    expect(upstream.agilePage).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ estado: "publicada", numero_pagina: "2" }),
    );
    expect(upstream.agilePage.mock.calls[0][1]).not.toHaveProperty("region");
    expect(upstream.agilePage.mock.calls[0][1]).not.toHaveProperty("q");
  });
  it("reutiliza el cache y busca manualmente sobre todo el listado nacional", async () => {
    await service.list(
      Object.assign(new RadarGeneralQueryDto(), { source: "licitacion" }),
    );
    const result = await service.list(
      Object.assign(new RadarGeneralQueryDto(), {
        source: "licitacion",
        q: "lapices",
      }),
    );
    expect(result.cached).toBe(true);
    expect(result.total).toBe(1);
    expect(upstream.activeLicitaciones).toHaveBeenCalledTimes(1);
  });
  it("ante 429 conserva el listado anterior y lo marca desactualizado", async () => {
    await service.list(
      Object.assign(new RadarGeneralQueryDto(), { source: "licitacion" }),
    );
    cache.get("licitacion:active").checked_at = new Date(
      Date.now() - 3600000,
    ).toISOString();
    upstream.activeLicitaciones.mockRejectedValue(
      new RadarUpstreamError("Pausa", 120),
    );
    const result = await service.list(
      Object.assign(new RadarGeneralQueryDto(), { source: "licitacion" }),
    );
    expect(result.stale).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(db.client.rpc).toHaveBeenCalledWith("radar_general_pause", {
      p_seconds: 120,
      p_message: "Pausa",
    });
  });
  it("un error sin cache no se presenta como cero oportunidades", async () => {
    upstream.activeLicitaciones.mockRejectedValue(
      new RadarUpstreamError("Pausa", 5),
    );
    await expect(
      service.list(
        Object.assign(new RadarGeneralQueryDto(), { source: "licitacion" }),
      ),
    ).rejects.toThrow("Pausa");
  });
  it("permite guardar una compra fuera del perfil usando la identidad del administrador", async () => {
    expect(await service.import("actor", "compra_agil", "999-1-COT26")).toEqual(
      { id: "saved-id" },
    );
    expect(db.client.rpc).toHaveBeenCalledWith(
      "radar_import_general",
      expect.objectContaining({
        p_actor: "actor",
        p_data: expect.objectContaining({
          match_kind: "manual",
          profile_ids: [],
        }),
      }),
    );
  });
  it("rechaza códigos manipulados y filtros regionales que la fuente básica no ofrece", async () => {
    await expect(
      service.import("actor", "compra_agil", "../secret"),
    ).rejects.toThrow();
    expect(upstream.detail).not.toHaveBeenCalled();
    await expect(
      service.list(
        Object.assign(new RadarGeneralQueryDto(), {
          source: "licitacion",
          region: 5,
        }),
      ),
    ).rejects.toThrow("nacional");
  });
});
