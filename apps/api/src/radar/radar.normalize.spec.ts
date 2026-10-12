import {
  explicitDate,
  fingerprint,
  keywordMatch,
  matchProfiles,
  normalizeAgil,
  normalizeLicitacion,
} from "./radar.normalize";
import type { RadarProfile } from "@costamar/shared";
const profile: RadarProfile = {
  id: "test",
  name: "Food",
  enabled: true,
  regions: [5],
  keywords: ["alimentación", "coffee"],
  exclude_keywords: ["menaje"],
  preferred_communes: ["Olmué"],
  min_budget: null,
  max_budget: null,
  include_unknown_budget: true,
  include_licitaciones: true,
  updated_at: "2026-10-12T00:00:00Z",
};
const agile = {
  codigo: "4469-321-COT26",
  nombre: "SERVICIO DE ALIMENTACION",
  estado: { codigo: "publicada" },
  convocatoria: { estado_convocatoria: 2 },
  fechas: { fecha_cierre: "2026-10-13 09:00" },
  institucion: { region: 5, organismo_comprador: "Universidad" },
  entrega: { direccion_entrega: "San Felipe" },
  presupuesto: {
    tipo_presupuesto: "Estimado",
    monto_disponible: 1315000,
    moneda: "CLP",
  },
  documentos: [{ id: 1967546, nombre: "Ficha.pdf" }],
  productos_solicitados: [
    {
      nombre: "Catering",
      cantidad: 1,
      unidad_medida: "EA",
      descripcion: "COLACIONES PARA 31 PERSONAS",
    },
  ],
};
describe("Datos oficiales de Radar", () => {
  it("conserva servicios globales, IDs enteros y presupuesto estimado sin inventar raciones", () => {
    const row = normalizeAgil(agile);
    expect(row.items[0]).toMatchObject({
      quantity: 1,
      unit: "EA",
      description: "COLACIONES PARA 31 PERSONAS",
    });
    expect(row.documents[0].id).toBe("1967546");
    expect(row.budget_type).toBe("Estimado");
    expect(row.delivery).toBe("San Felipe");
    expect(row.closes_at).toBeNull();
  });
  it("no adivina zona de cierre; acepta solo una fecha con zona explícita", () => {
    expect(explicitDate("2026-10-13 09:00")).toBeNull();
    expect(explicitDate("2026-10-13T09:00:00-03:00")).toBe(
      "2026-10-13T12:00:00.000Z",
    );
    expect(explicitDate("invalid")).toBeNull();
  });
  it("normaliza acentos y excluye falsos positivos configurados", () => {
    expect(keywordMatch("ALIMENTACION EN OLMUE", profile)).toBe(true);
    expect(keywordMatch("MENAJE PARA ALIMENTACIÓN", profile)).toBe(false);
  });
  it("la región no inventa cercanía: Juan Fernández conserva dirección real", () => {
    const row = normalizeAgil({
      ...agile,
      entrega: { direccion_entrega: "Juan Fernández" },
    });
    expect(matchProfiles(row, [profile])).toEqual(["test"]);
    expect(row.delivery).toBe("Juan Fernández");
    expect(row.buyer_commune).toBe("");
  });
  it("presupuestos y procedimientos respetan criterios del perfil", () => {
    const row = normalizeAgil(agile);
    expect(matchProfiles(row, [{ ...profile, max_budget: 500000 }])).toEqual(
      [],
    );
    expect(
      matchProfiles({ ...row, budget: null }, [
        { ...profile, include_unknown_budget: false },
      ]),
    ).toEqual([]);
    expect(matchProfiles({ ...row, region: 13 }, [profile])).toEqual([]);
  });
  it("normaliza licitaciones y oculta un monto marcado no visible", () => {
    const row = normalizeLicitacion({
      CodigoExterno: "551164-2-L126",
      Nombre: "Coffee break",
      CodigoEstado: 5,
      Comprador: {
        RegionUnidad: "Región de Valparaíso",
        ComunaUnidad: "Casablanca",
      },
      VisibilidadMonto: 0,
      MontoEstimado: 999999,
      Items: { Listado: [{ Cantidad: 1, UnidadMedida: "Global" }] },
    });
    expect(row.region).toBe(5);
    expect(row.budget).toBeNull();
    expect(row.items[0].quantity).toBe(1);
  });
  it("la huella ignora cambios de perfil y hora de consulta pero detecta cierres", () => {
    const row = normalizeAgil(agile);
    expect(fingerprint(row)).toBe(
      fingerprint({
        ...row,
        profile_ids: ["new"],
        source_changed_raw: "today",
      }),
    );
    expect(fingerprint(row)).not.toBe(
      fingerprint({ ...row, closes_raw: "2026-10-14 09:00" }),
    );
  });
  it("rechaza fichas incompletas para no consumir el cursor como si fueran válidas", () => {
    expect(() => normalizeAgil({ codigo: "unexpected" })).toThrow(
      "RADAR_SCHEMA",
    );
    expect(() =>
      normalizeLicitacion({ CodigoExterno: "551164-2-L126" }),
    ).toThrow("RADAR_SCHEMA");
  });
});
