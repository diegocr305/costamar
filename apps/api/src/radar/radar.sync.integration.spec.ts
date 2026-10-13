// Optional real PostgreSQL/PostgREST tests. The URL must be loopback and the database disposable.
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ConfigService } from "@nestjs/config";
import { SupabaseService } from "../supabase/supabase.service";
import {
  MercadoPublicoClient,
  RadarUpstreamError,
} from "./mercado-publico.client";
import { RadarEmailService } from "./radar.email";
import { RadarSync } from "./radar.sync";
const rest = process.env.RADAR_TEST_REST_URL;
if (rest && !["127.0.0.1", "localhost"].includes(new URL(rest).hostname))
  throw new Error(
    "Radar integration tests require a disposable loopback database.",
  );
const integration = rest ? describe : describe.skip;
integration("Radar sincronización con PostgreSQL real", () => {
  let db: any, sync: RadarSync, upstream: any, email: any;
  const detail = {
    codigo: "999999-1-COT26",
    nombre: "Coffee break de integración",
    estado: { codigo: "publicada" },
    institucion: { region: 5 },
    fechas: { fecha_cierre: "2026-12-01 09:00" },
    presupuesto: { moneda: "CLP", monto_disponible: 100000 },
    productos_solicitados: [],
  };
  async function checked(p: any) {
    const r = await p;
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  beforeAll(() => {
    const native = fetch;
    const client = createClient(rest!, "disposable-local-only", {
      auth: { persistSession: false },
      realtime: { transport: WebSocket as any },
      global: {
        fetch: (url, options) => {
          const u = new URL(String(url));
          u.pathname = u.pathname.replace(/^\/rest\/v1/, "");
          const headers = new Headers(options?.headers);
          headers.delete("authorization");
          return native(u, { ...options, headers });
        },
      },
    });
    db = { client };
  });
  beforeEach(async () => {
    for (const table of [
      "radar_alerts",
      "radar_versions",
      "radar_candidates",
      "radar_cursors",
      "radar_requests",
      "radar_opportunities",
    ])
      await checked(
        db.client
          .from(table)
          .delete()
          .not(
            table === "radar_cursors"
              ? "scope"
              : table === "radar_candidates"
                ? "code"
                : "id",
            "is",
            null,
          ),
      );
    await checked(
      db.client
        .from("radar_control")
        .update({
          owner: null,
          lease_until: null,
          queued: true,
          last_attempt_at: null,
          last_success_at: null,
          last_error: null,
          blocked_until: null,
        })
        .eq("id", 1),
    );
    upstream = {
      configured: () => true,
      agilePage: jest.fn().mockResolvedValue({
        items: [{ codigo: detail.codigo, nombre: detail.nombre }],
        paginacion: { total_paginas: 1 },
      }),
      activeLicitaciones: jest.fn().mockResolvedValue([]),
      detail: jest.fn().mockResolvedValue(detail),
    };
    email = { flush: jest.fn().mockResolvedValue(undefined) };
    sync = new RadarSync(
      db as SupabaseService,
      upstream as MercadoPublicoClient,
      new ConfigService({ RADAR_INTERVAL_SECONDS: 60 }),
      email as RadarEmailService,
    );
  });
  it("persiste detalle y cursor; una segunda revisión no duplica fichas ni avisos", async () => {
    await sync.tick();
    const rows = await checked(
      db.client.from("radar_opportunities").select("*"),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].closes_at).toBeNull();
    const cursor = await checked(
      db.client
        .from("radar_cursors")
        .select("*")
        .eq("scope", "compra_agil:5")
        .single(),
    );
    expect(cursor.mode).toBe("changes");
    expect(cursor.completed_at).not.toBeNull();
    await checked(
      db.client.from("radar_control").update({ queued: true }).eq("id", 1),
    );
    await sync.tick();
    expect(
      await checked(db.client.from("radar_opportunities").select("id")),
    ).toHaveLength(1);
    expect(
      await checked(db.client.from("radar_alerts").select("id")),
    ).toHaveLength(1);
  });
  it("reanuda en la página fallida, sin adelantar el cursor ni perder candidatos", async () => {
    upstream.agilePage
      .mockResolvedValueOnce({
        items: [{ codigo: detail.codigo, nombre: detail.nombre }],
        paginacion: { total_paginas: 3 },
      })
      .mockRejectedValueOnce(new RadarUpstreamError("Fallo de proveedor", 300));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    await sync.tick();
    log.mockRestore();
    const cursor = await checked(
      db.client
        .from("radar_cursors")
        .select("*")
        .eq("scope", "compra_agil:5")
        .single(),
    );
    expect(cursor.next_page).toBe(2);
    expect(cursor.completed_at).toBeNull();
    expect(
      await checked(db.client.from("radar_candidates").select("code")),
    ).toHaveLength(1);
    await checked(
      db.client
        .from("radar_control")
        .update({ queued: true, blocked_until: null })
        .eq("id", 1),
    );
    upstream.agilePage.mockResolvedValue({
      items: [],
      paginacion: { total_paginas: 2 },
    });
    await sync.tick();
    expect(upstream.agilePage.mock.calls.at(-1)[1].numero_pagina).toBe("2");
    expect(
      await checked(db.client.from("radar_opportunities").select("id")),
    ).toHaveLength(1);
  });
  it("una ficha desaparecida no impide procesar otras; permanece pendiente para reintento", async () => {
    const second = { ...detail, codigo: "999999-2-COT26" };
    upstream.agilePage.mockResolvedValue({
      items: [
        { codigo: detail.codigo, nombre: detail.nombre },
        { codigo: second.codigo, nombre: second.nombre },
      ],
      paginacion: { total_paginas: 1 },
    });
    upstream.detail.mockImplementation(
      (_owner: string, _source: string, code: string) =>
        code === detail.codigo
          ? Promise.reject(
              new RadarUpstreamError("No disponible", 0, false, true),
            )
          : Promise.resolve(second),
    );
    await sync.tick();
    expect(
      await checked(db.client.from("radar_opportunities").select("id")),
    ).toHaveLength(1);
    const candidates = await checked(
      db.client.from("radar_candidates").select("*"),
    );
    expect(candidates.find((x: any) => x.code === detail.codigo).failures).toBe(
      1,
    );
  });
  it("un cambio de perfil reinicia el descubrimiento de procesos ya abiertos", async () => {
    await sync.tick();
    await checked(
      db.client
        .from("radar_profiles")
        .update({ updated_at: new Date(Date.now() + 1000).toISOString() })
        .eq("enabled", true),
    );
    await checked(
      db.client.from("radar_control").update({ queued: true }).eq("id", 1),
    );
    await sync.tick();
    const params = upstream.agilePage.mock.calls.at(-1)[1];
    expect(params.estado).toBe("publicada");
    expect(params.cambio_desde).toBeUndefined();
  });
});
