export type LoyaltyLevel = 'bronce' | 'plata' | 'oro';
export type LoyaltyTransactionType =
  | 'acreditar'
  | 'canjear'
  | 'expirar'
  | 'ajuste';

export interface LoyaltyAccount {
  id: string;
  customerId: string;
  points: number;
  level: LoyaltyLevel;
  enrolledAt: string;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  accountId: string;
  type: LoyaltyTransactionType;
  /** Positivo para acreditar, negativo para canjear/expirar */
  points: number;
  orderId?: string;
  description?: string;
  createdAt: string;
}

export const LOYALTY_LEVEL_THRESHOLDS: Record<LoyaltyLevel, number> = {
  bronce: 0,
  plata: 500,
  oro: 2000,
};

/** Puntos por cada 100 CLP del total del pedido */
export const POINTS_PER_100_CLP = 1;
