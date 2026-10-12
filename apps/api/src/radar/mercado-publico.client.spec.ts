import { ConfigService } from "@nestjs/config";
import { MercadoPublicoClient, retrySeconds } from "./mercado-publico.client";
import { SupabaseService } from "../supabase/supabase.service";
describe("Mercado Público: credenciales, cuota y errores", () => {
  const ticket = "diagnostic-secret";
  let fetchMock: jest.SpyInstance;
  let client: MercadoPublicoClient;
  const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
  beforeEach(() => {
    jest.useFakeTimers();
    rpc.mockClear();
    fetchMock = jest.spyOn(global, "fetch");
    client = new MercadoPublicoClient(
      new ConfigService({ MERCADO_PUBLICO_TICKET: ticket }),
      { client: { rpc } } as unknown as SupabaseService,
    );
  });
  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });
  async function finish<T>(pending: Promise<T>) {
    await jest.runAllTimersAsync();
    return pending;
  }
  it("v2 usa cabecera y v1 solo parámetro en URL oficial", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: "OK",
          payload: { items: [], paginacion: { total_paginas: 0 } },
        }),
        { status: 200 },
      ),
    );
    await finish(client.agilePage("owner", { tamano_pagina: "50" }));
    expect(String(fetchMock.mock.calls[0][0])).not.toContain(ticket);
    expect(fetchMock.mock.calls[0][1].headers.ticket).toBe(ticket);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ Listado: [] }), { status: 200 }),
    );
    await finish(client.activeLicitaciones("owner"));
    expect(
      new URL(String(fetchMock.mock.calls[1][0])).searchParams.get("ticket"),
    ).toBe(ticket);
  });
  it("no hace solicitudes después de consumir la cuota", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(client.activeLicitaciones("owner")).rejects.toThrow("límite");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("respeta 429 y no reintenta autenticación rechazada", async () => {
    fetchMock.mockResolvedValue(
      new Response("{}", { status: 429, headers: { "Retry-After": "120" } }),
    );
    const outcome = client.activeLicitaciones("owner").catch((e) => e);
    const error = await finish(outcome);
    expect(error.pauseSeconds).toBe(120);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("no filtra URLs secretas de errores de TLS y aplica reintentos acotados", async () => {
    fetchMock.mockRejectedValue(
      new Error(`TLS https://api.mercadopublico.cl/?ticket=${ticket}`),
    );
    const error = await finish(
      client.activeLicitaciones("owner").catch((e) => e),
    );
    expect(error.message).not.toContain(ticket);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledTimes(3);
  });
  it("un HTTP 200 con fallo de aplicación no se interpreta como lista vacía", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: "NOK", payload: { items: [] } }), {
        status: 200,
      }),
    );
    const error = await finish(client.agilePage("owner", {}).catch((e) => e));
    expect(error.message).toContain("no confirmó");
  });
  it("interpreta Retry-After numérico o fecha y pone límites", () => {
    expect(retrySeconds("0")).toBe(1);
    expect(retrySeconds("999999")).toBe(86400);
    expect(retrySeconds("bad")).toBe(300);
  });
});
