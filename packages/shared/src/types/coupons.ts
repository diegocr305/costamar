/**
 * Tipos del sistema de cupones del Club Costa Mar (V1).
 * La API es la única autoridad de elegibilidad, emisión y canje.
 */

export type CampaignType = 'birthday' | 'founders';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'closed';
export type CouponStatus = 'issued' | 'redeemed' | 'expired' | 'void';
export type CampaignProductRole = 'drink' | 'dessert' | 'gift';

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  description?: string;
  imagePath?: string;
  type: CampaignType;
  status: CampaignStatus;
  startsAt?: string;
  endsAt?: string;
  maxCoupons?: number | null;
  /** Reglas configurables (ej. requiresConsumption, minAge). */
  rules: Record<string, unknown>;
}

export interface CampaignProduct {
  productId: string;
  role: CampaignProductRole;
  name: string;
  imagePath?: string;
}

export interface Coupon {
  id: string;
  code: string;
  campaignId: string;
  status: CouponStatus;
  issuedAt: string;
  expiresAt?: string | null;
  redeemedAt?: string | null;
}

/** Cupón con datos de su campaña, para mostrar en la PWA. */
export interface CouponWithCampaign extends Coupon {
  campaign: Pick<
    Campaign,
    'name' | 'description' | 'imagePath' | 'type' | 'slug'
  >;
}

/** Resultado de evaluar elegibilidad (sin emitir). */
export interface EligibilityResult {
  campaignSlug: string;
  eligible: boolean;
  /** Motivo cuando no es elegible (para mostrar al socio). */
  reason?: string;
}

/** Edad mínima para el club y campañas con alcohol. */
export const CLUB_MIN_AGE = 18;

/** Zona horaria oficial para cálculos de fecha/cumpleaños. */
export const CLUB_TIMEZONE = 'America/Santiago';
