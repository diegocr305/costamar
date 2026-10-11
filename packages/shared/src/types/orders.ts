import type { OrderStatus } from '../constants/order-states';

export type OrderModality = 'retiro' | 'delivery';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Order {
  id: string;
  customerId?: string;
  modality: OrderModality;
  status: OrderStatus;
  totalAmount: number;
  discount: number;
  contactName: string;
  contactPhone: string;
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface CreateOrderDto {
  modality: OrderModality;
  contactName: string;
  contactPhone: string;
  deliveryAddress?: string;
  notes?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
  couponCode?: string;
}
