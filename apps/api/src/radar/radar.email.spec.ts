import { ConfigService } from "@nestjs/config";
import { RadarEmailService } from "./radar.email";
import { SupabaseService } from "../supabase/supabase.service";
describe("Radar correo: activación e idempotencia", () => {
  let fetchMock: jest.SpyInstance, row: any, db: any, updates: any[];
  const base = {
    RADAR_EMAIL_ENABLED: "true",
    RADAR_EMAIL_FROM: "Radar <radar@example.test>",
    RADAR_EMAIL_TO: "owner@example.test",
    RESEND_API_KEY: "test-key",
  };
  beforeEach(() => {
    fetchMock = jest.spyOn(global, "fetch");
    updates = [];
    row = {
      id: "alert-id",
      title: "Nueva oportunidad",
      message: "Coffee break",
      opportunity_id: "process",
      created_at: new Date().toISOString(),
      email_state: "pending",
      email_attempts: 0,
      email_first_attempt_at: null,
      email_payload: null,
    };
    const chain: any = {};
    for (const key of ["select", "in", "lte", "order"])
      chain[key] = () => chain;
    chain.limit = async () => ({ data: [{ ...row }], error: null });
    db = {
      client: {
        from: () => ({
          ...chain,
          update: (patch: any) => ({
            eq: async () => {
              updates.push(patch);
              Object.assign(row, patch);
              return { data: null, error: null };
            },
          }),
        }),
      },
    };
  });
  afterEach(() => fetchMock.mockRestore());
  it("no envía sin activación y configuración completa", async () => {
    await new RadarEmailService(
      new ConfigService({ ...base, RADAR_EMAIL_ENABLED: "false" }),
      db as SupabaseService,
    ).flush();
    expect(fetchMock).not.toHaveBeenCalled();
    await new RadarEmailService(
      new ConfigService({ ...base, RADAR_EMAIL_TO: "invalid" }),
      db as SupabaseService,
    ).flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("un fallo ambiguo conserva cuerpo y clave al reintentar aunque cambie la configuración", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "provider-id" }), { status: 200 }),
      );
    await new RadarEmailService(
      new ConfigService(base),
      db as SupabaseService,
    ).flush();
    expect(row.email_state).toBe("failed");
    await new RadarEmailService(
      new ConfigService({ ...base, RADAR_EMAIL_TO: "other@example.test" }),
      db as SupabaseService,
    ).flush();
    const first = fetchMock.mock.calls[0][1],
      second = fetchMock.mock.calls[1][1];
    expect(first.body).toBe(second.body);
    expect(first.headers["Idempotency-Key"]).toBe(
      second.headers["Idempotency-Key"],
    );
    expect(row.email_state).toBe("sent");
  });
  it("no reenvía a ciegas fuera de la ventana de idempotencia", async () => {
    row.email_first_attempt_at = new Date(
      Date.now() - 24 * 3600000,
    ).toISOString();
    await new RadarEmailService(
      new ConfigService(base),
      db as SupabaseService,
    ).flush();
    expect(row.email_state).toBe("review");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("no activa una avalancha de correos antiguos al configurar el proveedor", async () => {
    row.created_at = new Date(Date.now() - 48 * 3600000).toISOString();
    await new RadarEmailService(
      new ConfigService(base),
      db as SupabaseService,
    ).flush();
    expect(row.email_state).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
