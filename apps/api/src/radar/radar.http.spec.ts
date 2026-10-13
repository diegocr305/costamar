import {
  UnauthorizedException,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { RadarController } from "./radar.controller";
import { RadarService } from "./radar.service";
import { RadarGeneralService } from "./radar.general";
import { RolesGuard } from "../common/guards/roles.guard";
const service = {
  list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  detail: jest.fn().mockResolvedValue({ id: "test" }),
  tracking: jest.fn().mockResolvedValue({}),
  profiles: jest.fn().mockResolvedValue([]),
  saveProfile: jest.fn().mockResolvedValue({}),
  status: jest.fn().mockResolvedValue({}),
  queue: jest.fn().mockResolvedValue({ queued: true }),
  alerts: jest.fn().mockResolvedValue([]),
  readAlert: jest.fn().mockResolvedValue({}),
  upload: jest.fn().mockResolvedValue({}),
  document: jest.fn().mockResolvedValue({}),
};
class Identity implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const role = req.headers["x-test-role"];
    if (!role) throw new UnauthorizedException();
    req.user = { userId: "11111111-1111-4111-8111-111111111111", role };
    return true;
  }
}
describe("Radar HTTP: acceso y validación", () => {
  let app: INestApplication, url: string;
  const id = "11111111-1111-4111-8111-111111111111";
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RadarController],
      providers: [
        { provide: RadarService, useValue: service },
        {
          provide: RadarGeneralService,
          useValue: {
            list: jest.fn().mockResolvedValue({ items: [], total: 0 }),
            import: jest.fn().mockResolvedValue({ id: "test" }),
          },
        },
        { provide: APP_GUARD, useClass: Identity },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0, "127.0.0.1");
    url = await app.getUrl();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  it("protege General diario y valida sus parámetros", async () => {
    expect(
      (
        await fetch(url + "/radar/general", {
          headers: { "x-test-role": "cashier" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await fetch(url + "/radar/general", {
          headers: { "x-test-role": "admin" },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await fetch(url + "/radar/general?source=private", {
          headers: { "x-test-role": "admin" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url + "/radar/general?region=17", {
          headers: { "x-test-role": "admin" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url + "/radar/general/compra_agil/999-1-COT26/import", {
          method: "POST",
          headers: { "x-test-role": "cashier" },
        })
      ).status,
    ).toBe(403);
  });
  it("requiere sesión y deniega roles operativos y clientes en todas las rutas", async () => {
    expect((await fetch(url + "/radar/opportunities")).status).toBe(401);
    for (const role of [
      "customer",
      "cashier",
      "manager",
      "kitchen",
      "inventory",
    ])
      for (const route of [
        "/radar/opportunities",
        "/radar/opportunities/" + id,
        "/radar/sync/status",
        "/radar/profiles",
        "/radar/alerts",
      ])
        expect(
          (await fetch(url + route, { headers: { "x-test-role": role } }))
            .status,
        ).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });
  it("permite lectura administrativa y rechaza filtros manipulados antes del servicio", async () => {
    const headers = { "x-test-role": "admin" };
    expect(
      (
        await fetch(url + "/radar/opportunities?page=2&favorite=true", {
          headers,
        })
      ).status,
    ).toBe(200);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, favorite: "true" }),
    );
    for (const route of [
      "/radar/opportunities?page=-1",
      "/radar/opportunities?source=private",
      "/radar/opportunities?ticket=secret",
      "/radar/opportunities/not-uuid",
    ])
      expect((await fetch(url + route, { headers })).status).toBe(400);
  });
  it("usa identidad de sesión para seguimiento; no permite cambiar estado oficial ni inyectar actor", async () => {
    const headers = {
        "x-test-role": "superadmin",
        "Content-Type": "application/json",
      },
      body = {
        stage: "Cotizando",
        favorite: true,
        notes: "Revisar",
        expected_updated_at: "none",
      };
    expect(
      (
        await fetch(url + `/radar/opportunities/${id}/tracking`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(200);
    expect(service.tracking).toHaveBeenCalledWith(
      id,
      id,
      expect.objectContaining(body),
    );
    expect(
      (
        await fetch(url + `/radar/opportunities/${id}/tracking`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ ...body, official_status: "adjudicada" }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url + "/radar/sync", {
          method: "POST",
          headers: { "x-test-role": "cashier" },
        })
      ).status,
    ).toBe(403);
  });
  it("valida perfiles y rutas de documentos privados", async () => {
    const headers = {
        "x-test-role": "admin",
        "Content-Type": "application/json",
      },
      body = {
        name: "Perfil",
        enabled: true,
        regions: [5],
        keywords: ["coffee"],
        exclude_keywords: [],
        preferred_communes: [],
        min_budget: null,
        max_budget: null,
        include_unknown_budget: true,
        include_licitaciones: true,
      };
    expect(
      (
        await fetch(url + "/radar/profiles", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await fetch(url + "/radar/profiles", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...body, regions: [99] }),
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await fetch(url + `/radar/opportunities/${id}/documents/${id}`, {
          headers: { "x-test-role": "customer" },
        })
      ).status,
    ).toBe(403);
  });
});
