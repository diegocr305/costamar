import { classifyOpportunity, discoveryKind } from "./radar.match";
import { normalizeAgil } from "./radar.normalize";
import type { RadarProfile } from "@costamar/shared";
const profile: RadarProfile = {
  id: "profile",
  name: "Food",
  enabled: true,
  regions: [5],
  keywords: ["alimentacion", "colaciones", "almuerzos", "coffee", "catering"],
  exclude_keywords: ["menaje", "vajilla", "desechable", "nutricion enteral"],
  preferred_communes: [],
  min_budget: null,
  max_budget: null,
  include_unknown_budget: true,
  include_licitaciones: true,
  updated_at: "",
};
const row = (name: string, items: any[] = []) =>
  normalizeAgil({
    codigo: "999-1-COT26",
    nombre: name,
    estado: { codigo: "publicada" },
    institucion: { region: 5 },
    productos_solicitados: items,
    presupuesto: { moneda: "CLP", monto_disponible: 1000 },
  });
describe("Radar: cobertura conservadora", () => {
  it.each([
    "Colación de funcionarios",
    "Almuerzo institucional",
    "Cena de aniversario",
    "Servicio de coffe break",
    "COFEE BREAK",
    "Refrigerios",
    "Box lunch",
    "Cóctel institucional",
  ])("reconoce variantes: %s", (name) => {
    expect(discoveryKind("compra_agil", name, profile)).toBe("matched");
    expect(classifyOpportunity(row(name), [profile]).match_kind).toBe(
      "matched",
    );
  });
  it("un catering con vasos desechables pasa a revisión y no desaparece", () => {
    const result = classifyOpportunity(
      row("Coffee break con vasos desechables"),
      [profile],
    );
    expect(result.profile_ids).toEqual(["profile"]);
    expect(result.match_kind).toBe("review");
    expect(result.match_reasons[0]).toContain("palabras excluidas");
  });
  it("coffe mug y cafeteras no se presentan como coincidencias claras", () => {
    expect(
      classifyOpportunity(row("Adquisición COFFE MUG"), [profile]).match_kind,
    ).toBe("review");
    expect(discoveryKind("compra_agil", "Cafetera", profile)).toBeNull();
  });
  it("un título genérico de jornada se conserva para revisión posterior", () => {
    expect(
      discoveryKind(
        "licitacion",
        "Servicio para jornada institucional",
        profile,
      ),
    ).toBe("review");
    expect(
      classifyOpportunity(row("Servicio para jornada institucional"), [profile])
        .profile_ids,
    ).toEqual(["profile"]);
  });
  it("el detalle puede confirmar comida por un código oficial aun sin palabra en el título", () => {
    const result = classifyOpportunity(
      row("Solicitud 123", [
        {
          codigo_producto: 90101603,
          nombre: "Servicio",
          descripcion: "",
          cantidad: 1,
          unidad_medida: "EA",
        },
      ]),
      [profile],
    );
    expect(result.match_kind).toBe("matched");
    expect(result.profile_ids).toEqual(["profile"]);
  });
  it("región, presupuesto y activación siguen respetándose", () => {
    expect(
      classifyOpportunity(row("Coffee break"), [{ ...profile, regions: [13] }])
        .profile_ids,
    ).toEqual([]);
    expect(
      classifyOpportunity(row("Coffee break"), [{ ...profile, max_budget: 1 }])
        .profile_ids,
    ).toEqual([]);
    expect(
      discoveryKind("licitacion", "Almuerzo", {
        ...profile,
        include_licitaciones: false,
      }),
    ).toBeNull();
  });
  it("no convierte palabras que solo contienen una cadena en comida", () => {
    expect(
      discoveryKind("compra_agil", "Desayunominformatica", profile),
    ).toBeNull();
  });
});
