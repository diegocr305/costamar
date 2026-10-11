export type ReservationStatus =
  | 'pendiente'
  | 'confirmada'
  | 'cancelada'
  | 'completada';

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  partySize: number;
  reservedAt: string; // ISO datetime
  status: ReservationStatus;
  tableId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDto {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  partySize: number;
  reservedAt: string;
  notes?: string;
}
