export type ReservationStatus='pending'|'confirmed'|'seated'|'completed'|'cancelled'|'no_show';
export type ReservationArea='any'|'salon'|'terraza'|'barra';
export interface ReservationEvent {event:string;actorName:string;createdAt:string;meta:Record<string,unknown>;}
export interface Reservation {
 id:string;reference:string;customerName:string;customerPhone:string;partySize:number;reservedAt:string;
 durationMinutes:number;bufferMinutes:number;toleranceMinutes:number;status:ReservationStatus;
 areaPreference:ReservationArea;tableNumbers:number[];confirmedCapacity:number|null;
 notes:string;staffNote?:string;source:'web'|'club'|'admin';createdAt:string;updatedAt:string;events?:ReservationEvent[];
 seatedAt?:string|null;releasedAt?:string|null;
 assignedArea?:Exclude<ReservationArea,'any'>|null;
}
export interface CreateReservationDto {requestId:string;accessToken:string;customerName:string;customerPhone:string;partySize:number;reservedAt:string;areaPreference?:ReservationArea;notes?:string;website?:string;}
export interface ReservationConfig {
 durationSmall:number;durationLarge:number;bufferMinutes:number;toleranceMinutes:number;advanceMinutes:number;
 hours:{day:number;opens:string;closes:string;isOpen:boolean}[];
 tables?:{number:number;area:Exclude<ReservationArea,'any'>;comfortable:number;maximum:number}[];
 pairs?:{a:number;b:number;capacity:number|null;enabled?:boolean}[];
}
export interface ReservationPage {items:Reservation[];total:number;page:number;pageSize:number;}
export const RESERVATION_LABELS:Record<ReservationStatus,string>={pending:'Pendiente de confirmar',confirmed:'Confirmada',seated:'En el local',completed:'Visita finalizada',cancelled:'Cancelada',no_show:'No asistió'};
export const RESERVATION_AREAS:Record<ReservationArea,string>={any:'Sin preferencia',salon:'Salón',terraza:'Terraza',barra:'Barra'};
