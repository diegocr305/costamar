export const RADAR_STAGES = [
  "Nueva",
  "Analizando",
  "Interesante",
  "Cotizando",
  "Postulada",
  "Adjudicada",
  "No adjudicada",
  "Descartada",
] as const;
export type RadarStage = (typeof RADAR_STAGES)[number];
export type RadarSource = "compra_agil" | "licitacion";
export const RADAR_REGIONS = [
  { code: 1, name: "Tarapacá" },
  { code: 2, name: "Antofagasta" },
  { code: 3, name: "Atacama" },
  { code: 4, name: "Coquimbo" },
  { code: 5, name: "Valparaíso" },
  { code: 6, name: "O’Higgins" },
  { code: 7, name: "Maule" },
  { code: 8, name: "Biobío" },
  { code: 9, name: "La Araucanía" },
  { code: 10, name: "Los Lagos" },
  { code: 11, name: "Aysén" },
  { code: 12, name: "Magallanes" },
  { code: 13, name: "Metropolitana" },
  { code: 14, name: "Los Ríos" },
  { code: 15, name: "Arica y Parinacota" },
  { code: 16, name: "Ñuble" },
] as const;
export interface RadarItem {
  code: string;
  name: string;
  description: string;
  quantity: number | null;
  unit: string;
}
export interface RadarDocument {
  id: string;
  name: string;
}
export interface RadarOpportunity {
  id: string;
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
  verified_closes_at: string | null;
  published_raw: string;
  source_changed_raw: string;
  checked_at: string;
  detail_checked_at: string | null;
  created_at: string;
  items: RadarItem[];
  documents: RadarDocument[];
  profile_ids: string[];
  stage: RadarStage;
  favorite: boolean;
  notes: string;
  tracking_updated_at: string | null;
}
export interface RadarProfile {
  id: string;
  name: string;
  enabled: boolean;
  regions: number[];
  keywords: string[];
  exclude_keywords: string[];
  preferred_communes: string[];
  min_budget: number | null;
  max_budget: number | null;
  include_unknown_budget: boolean;
  include_licitaciones: boolean;
  updated_at: string;
}
export interface RadarAlert {
  id: string;
  opportunity_id: string;
  kind: "new" | "changed" | "closing";
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  email_state: string;
}
export interface RadarStatus {
  configured: boolean;
  emailConfigured: boolean;
  emailEnabled: boolean;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  worker_seen_at: string | null;
  queued: boolean;
  running: boolean;
  blocked_until: string | null;
  calls24h: number;
  opportunities: number;
  unread: number;
  cursors: {
    scope: string;
    completed_at: string | null;
    next_page: number;
    mode: string;
  }[];
}
export interface RadarList {
  items: RadarOpportunity[];
  total: number;
  page: number;
  pageSize: number;
}
