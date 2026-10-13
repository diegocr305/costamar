import type { RadarSource, RadarItem, RadarDocument } from "@costamar/shared";
import { deadlineInstant } from '@costamar/shared';
import { createHash } from "crypto";
export type JsonObject = Record<string, any>;
export function fold(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
const str = (x: unknown) => (typeof x === "string" ? x.trim() : "");
const num = (x: unknown): number | null =>
  x !== null && x !== undefined && x !== "" && Number.isFinite(Number(x))
    ? Number(x)
    : null;
export function validCode(source: RadarSource, value: string): boolean {
  return source === "compra_agil"
    ? /^\d+-\d+-COT\d{2}$/.test(value)
    : /^\d+-\d+-[A-Z0-9]{2,5}\d{2}$/.test(value);
}
// Never infer a timezone from a bare official deadline. Verification can be recorded in Admin.
export function explicitDate(value: string): string | null {
  const date = deadlineInstant(value);
  return date === null ? null : new Date(date).toISOString();
}
const regions = [
  "tarapaca",
  "antofagasta",
  "atacama",
  "coquimbo",
  "valparaiso",
  "ohiggins",
  "maule",
  "biobio",
  "araucania",
  "los lagos",
  "aysen",
  "magallanes",
  "metropolitana",
  "los rios",
  "arica",
  "nuble",
];
function regionNumber(value: unknown): number | null {
  const text = fold(value).replace(/[^a-z ]/g, "");
  const index = regions.findIndex((r) => text.includes(r));
  return index < 0 ? null : index + 1;
}
export interface NormalizedOpportunity {
  source: RadarSource;
  code: string;
  name: string;
  description: string;
  official_status: string;
  buyer: string;
  buyer_rut: string;
  region: number | null;
  buyer_commune: string;
  delivery: string;
  delivery_days: number | null;
  budget: number | null;
  currency: string;
  budget_type: string;
  call_number: number | null;
  closes_raw: string;
  closes_at: string | null;
  published_raw: string;
  source_changed_raw: string;
  items: RadarItem[];
  documents: RadarDocument[];
  profile_ids: string[];
}
export function normalizeAgil(p: JsonObject): NormalizedOpportunity {
  if (
    !validCode("compra_agil", p.codigo ?? "") ||
    !p.nombre ||
    !p.estado?.codigo
  )
    throw new Error("RADAR_SCHEMA");
  const b = p.presupuesto ?? p.montos ?? {},
    f = p.fechas ?? {},
    i = p.institucion ?? {};
  return {
    source: "compra_agil",
    code: p.codigo,
    name: str(p.nombre),
    description: str(p.descripcion),
    official_status: str(p.estado.codigo),
    buyer: str(i.organismo_comprador),
    buyer_rut: str(i.rut),
    region: num(i.region),
    buyer_commune: "",
    delivery: str(p.entrega?.direccion_entrega),
    delivery_days: num(p.entrega?.plazo_entrega_dias),
    budget: num(b.monto_disponible ?? b.presupuesto_estimado),
    currency: str(b.moneda),
    budget_type: str(b.tipo_presupuesto) || "No informado",
    call_number: num(p.convocatoria?.estado_convocatoria),
    closes_raw: str(f.fecha_cierre),
    closes_at: explicitDate(str(f.fecha_cierre)),
    published_raw: str(f.fecha_publicacion),
    source_changed_raw: str(f.fecha_ultimo_cambio),
    profile_ids: [],
    items: (p.productos_solicitados ?? []).map((x: JsonObject) => ({
      code: String(x.codigo_producto ?? ""),
      name: str(x.nombre),
      description: str(x.descripcion),
      quantity: num(x.cantidad),
      unit: str(x.unidad_medida),
    })),
    documents: (p.documentos ?? []).map((x: JsonObject) => ({
      id: String(x.id ?? ""),
      name: str(x.nombre),
    })),
  };
}
export function normalizeLicitacion(p: JsonObject): NormalizedOpportunity {
  if (
    !validCode("licitacion", p.CodigoExterno ?? "") ||
    !p.Nombre ||
    p.CodigoEstado == null
  )
    throw new Error("RADAR_SCHEMA");
  const c = p.Comprador ?? {},
    f = p.Fechas ?? {};
  const states: Record<number, string> = {
    5: "publicada",
    6: "cerrada",
    7: "desierta",
    8: "adjudicada",
    18: "revocada",
    19: "suspendida",
  };
  const closes = str(f.FechaCierre ?? p.FechaCierre);
  return {
    source: "licitacion",
    code: p.CodigoExterno,
    name: str(p.Nombre),
    description: str(p.Descripcion),
    official_status: states[p.CodigoEstado] ?? (str(p.Estado) || "desconocido"),
    buyer: str(c.NombreOrganismo),
    buyer_rut: str(c.RutUnidad),
    region: regionNumber(c.RegionUnidad),
    buyer_commune: str(c.ComunaUnidad),
    delivery: str(p.DireccionEntrega),
    delivery_days: null,
    budget:
      p.VisibilidadMonto !== undefined && Number(p.VisibilidadMonto) === 0
        ? null
        : num(p.MontoEstimado),
    currency: str(p.Moneda),
    budget_type: "Estimado / verificar bases",
    call_number: null,
    closes_raw: closes,
    closes_at: explicitDate(closes),
    published_raw: str(f.FechaPublicacion),
    source_changed_raw: str(f.FechaUltimaModificacion),
    profile_ids: [],
    documents: [],
    items: (p.Items?.Listado ?? []).map((x: JsonObject) => ({
      code: String(x.CodigoProducto ?? ""),
      name: str(x.NombreProducto),
      description: str(x.Descripcion),
      quantity: num(x.Cantidad),
      unit: str(x.UnidadMedida),
    })),
  };
}
export function fingerprint(row: NormalizedOpportunity): string {
  const stable: Record<string, unknown> = { ...row };
  for (const key of [
    "profile_ids",
    "source_changed_raw",
    "match_kind",
    "match_reasons",
    "manual_selected",
  ])
    delete stable[key];
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
