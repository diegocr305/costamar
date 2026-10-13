import type { RadarProfile, RadarSource } from "@costamar/shared";
import { fold, NormalizedOpportunity } from "./radar.normalize";
// Explicit variants, not a universal stemming rule: avoid turning unrelated words into food.
const groups = [
  [
    "alimentacion",
    "alimentos",
    "alimento",
    "comida",
    "comidas",
    "racion",
    "raciones",
  ],
  [
    "colacion",
    "colaciones",
    "refrigerio",
    "refrigerios",
    "lunch",
    "box lunch",
    "boxlunch",
  ],
  ["desayuno", "desayunos"],
  ["almuerzo", "almuerzos"],
  ["cena", "cenas"],
  [
    "coffee",
    "coffe",
    "cofee",
    "cafe",
    "coffee break",
    "coffe break",
    "cafe break",
  ],
  [
    "catering",
    "banqueteria",
    "banquete",
    "banquetes",
    "coctel",
    "cocteles",
    "cocktail",
    "cocktails",
  ],
  ["empanada", "empanadas"],
  ["bebida", "bebidas", "jugo", "jugos", "limonada"],
  ["fruta", "frutas"],
  ["verdura", "verduras"],
  ["abarrote", "abarrotes"],
  ["gastronomico", "gastronomicos", "gastronomica", "gastronomicas"],
];
const genericContexts = [
  "jornada",
  "jornadas",
  "evento",
  "eventos",
  "celebracion",
  "celebraciones",
  "aniversario",
  "seminario",
  "seminarios",
  "recepcion",
  "recepciones",
];
const nonFoodObjects = [
  "mug",
  "mugs",
  "taza",
  "tazas",
  "cafetera",
  "cafeteras",
  "maquina de cafe",
  "maquinas de cafe",
];
function exclusions(text: string, profile: RadarProfile): boolean {
  const terms = [...profile.exclude_keywords, ...nonFoodObjects];
  if (profile.exclude_keywords.some((x) => fold(x) === "desechable"))
    terms.push("desechables");
  return terms.some((term) => phrase(text, term));
}
function phrase(text: string, term: string): boolean {
  const escaped = fold(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:^|[^a-z0-9])${escaped.replace(/\s+/g, "\\s+")}(?:$|[^a-z0-9])`,
  ).test(fold(text));
}
export function expandedTerms(keywords: string[]): string[] {
  const terms = new Set(keywords.map(fold));
  for (const group of groups)
    if (group.some((word) => terms.has(word)))
      for (const word of group) terms.add(word);
  // Known restaurant profiles often already say catering/food but omit dinner or snacks.
  if (groups[0].some((word) => terms.has(word)) || terms.has("catering"))
    for (const word of [
      "cena",
      "cenas",
      "refrigerio",
      "refrigerios",
      "lunch",
      "box lunch",
    ])
      terms.add(word);
  return [...terms];
}
export function discoveryKind(
  source: RadarSource,
  text: string,
  profile: RadarProfile,
): "matched" | "review" | null {
  if (
    !profile.enabled ||
    (source === "licitacion" && !profile.include_licitaciones)
  )
    return null;
  const positive = expandedTerms(profile.keywords).some((term) =>
    phrase(text, term),
  );
  const negative = exclusions(text, profile);
  if (positive) return negative ? "review" : "matched";
  return genericContexts.some((term) => phrase(text, term)) ? "review" : null;
}
export function classifyOpportunity(
  row: NormalizedOpportunity,
  profiles: RadarProfile[],
) {
  const text = [
    row.name,
    row.description,
    ...row.items.map((x) => `${x.name} ${x.description}`),
  ].join(" ");
  // These exact UNSPSC codes were present in the official responses reviewed for this project.
  const foodCode = row.items.some((x) =>
    ["90101603", "50201706", "50202308"].includes(x.code),
  );
  const broadCode = row.items.some((x) => /^50\d{6}$/.test(x.code));
  const profileIds: string[] = [];
  const reasons = new Set<string>();
  let confident = false;
  for (const profile of profiles) {
    if (
      !profile.enabled ||
      (row.source === "licitacion" && !profile.include_licitaciones) ||
      (row.region !== null && !profile.regions.includes(row.region))
    )
      continue;
    if (row.budget === null || row.currency !== "CLP") {
      if (!profile.include_unknown_budget) continue;
    } else if (
      (profile.min_budget !== null && row.budget < profile.min_budget) ||
      (profile.max_budget !== null && row.budget > profile.max_budget)
    )
      continue;
    const positive = expandedTerms(profile.keywords).some((term) =>
      phrase(text, term),
    );
    const negative = exclusions(text, profile);
    const context = genericContexts.some((term) => phrase(text, term));
    if (!positive && !foodCode && !broadCode && !context) continue;
    profileIds.push(profile.id);
    // Exclusions become a reason to inspect, not an unconditional veto of mixed purchases.
    if ((positive || foodCode) && !negative) {
      confident = true;
      reasons.add(
        foodCode
          ? "Código de producto alimenticio reconocido."
          : "Coincidencia con palabras o variantes del perfil.",
      );
    } else {
      if (negative)
        reasons.add(
          "También contiene palabras excluidas: revisar si son insumos o parte de un servicio de comida.",
        );
      if (!positive && !foodCode)
        reasons.add(
          broadCode
            ? "Categoría amplia de alimentos/bebidas: verificar productos."
            : "Título de jornada o evento: comprobar si incluye alimentación.",
        );
    }
  }
  return {
    profile_ids: profileIds,
    match_kind: confident ? ("matched" as const) : ("review" as const),
    match_reasons: [...reasons],
  };
}
