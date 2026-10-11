/**
 * Estados válidos del ciclo de vida de un pedido.
 */
export const ORDER_STATES = [
  'recibido',
  'en_preparacion',
  'listo',
  'entregado',
  'cancelado',
] as const;

export type OrderStatus = (typeof ORDER_STATES)[number];

/**
 * Transiciones de estado válidas por rol.
 * El cliente solo puede cancelar desde 'recibido'.
 */
export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  recibido: ['en_preparacion', 'cancelado'],
  en_preparacion: ['listo'],
  listo: ['entregado'],
  entregado: [],
  cancelado: [],
};

/** Estados desde los cuales el cliente NO puede cancelar */
export const NON_CANCELLABLE_BY_CUSTOMER: OrderStatus[] = [
  'en_preparacion',
  'listo',
  'entregado',
];
