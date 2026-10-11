export interface Unit {
  id: number;
  name: string;
  symbol: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unitId: number;
  unit?: Unit;
  currentStock: number;
  reorderPoint: number;
  unitCost: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** true cuando currentStock <= reorderPoint */
  hasLowStock?: boolean;
}

export type MovementType = 'entrada' | 'salida' | 'merma' | 'ajuste';

export interface StockMovement {
  id: string;
  ingredientId: string;
  lotId?: string;
  movementType: MovementType;
  quantity: number;
  reason?: string;
  actorId: string;
  createdAt: string;
}

export interface CreateStockMovementDto {
  ingredientId: string;
  movementType: MovementType;
  quantity: number;
  reason?: string;
}
