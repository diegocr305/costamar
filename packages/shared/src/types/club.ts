import type { LoyaltyLevel } from './loyalty';

/**
 * Tipos del Club Costa Mar (programa de fidelización).
 *
 * En esta fase se cubre identidad y membresía digital; los puntos y canjes
 * se modelan en loyalty.ts y se implementan después. La identidad del socio
 * es el UUID de auth.users de Supabase.
 */

/** Estado de la membresía del socio. */
export type MembershipStatus = 'active' | 'suspended';

/**
 * Versión vigente de los documentos legales. Al cambiar un documento se
 * incrementa su versión y se vuelve a pedir el consentimiento.
 */
export const CLUB_TERMS_VERSION = '2026-10-11';
export const CLUB_PRIVACY_VERSION = '2026-10-11';

/** Tipos de consentimiento. 'terms' y 'privacy' son obligatorios; 'marketing' opcional. */
export type ConsentType = 'terms' | 'privacy' | 'marketing';

export interface ClubMember {
  /** UUID de auth.users (identidad del socio). */
  userId: string;
  /** Código público de socio, p. ej. "CM-7F3A2B". No es credencial de canje. */
  memberCode: string;
  fullName: string;
  phone?: string;
  status: MembershipStatus;
  level: LoyaltyLevel;
  enrolledAt: string;
  updatedAt: string;
}

export interface ClubConsent {
  type: ConsentType;
  version: string;
  granted: boolean;
  grantedAt: string;
}

export interface ClubMemberPreferences {
  marketingEmail: boolean;
  marketingWhatsapp: boolean;
}

/** Respuesta de GET /club/me cuando el usuario está autenticado. */
export interface ClubMeResponse {
  /** null si el usuario autenticado aún no es socio (perfil incompleto). */
  member: ClubMember | null;
  preferences: ClubMemberPreferences | null;
}

/** Payload de alta/completar perfil (POST /club/enroll). */
export interface ClubEnrollRequest {
  fullName: string;
  phone?: string;
  /** Debe ser true: aceptación de términos y privacidad (obligatorio). */
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  /** Opcional e independiente: comunicaciones promocionales. */
  marketingEmail?: boolean;
  marketingWhatsapp?: boolean;
}
