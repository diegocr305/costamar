import { BadRequestException,ConflictException,ForbiddenException,Injectable,NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateBookingDto,BookingQueryDto,UpdateBookingDto,BookingConfigDto } from './reservations.dto';
@Injectable()
export class ReservationsService {
 constructor(private readonly supabase:SupabaseService){}
 private hash(token:string){return createHash('sha256').update(token).digest('hex');}
 private async rpc(name:string,args:Record<string,unknown>={}){
  const {data,error}=await this.supabase.client.rpc(name,args);
  if(error){
   const messages:Record<string,string>={RESERVATION_HOURS:'Elige una hora dentro del horario de atención y con tiempo para tu visita.',RESERVATION_ADVANCE:'Revisa la anticipación mínima. Para una visita más cercana, contacta al restaurante.',RESERVATION_SLOT:'Elige una de las horas disponibles en el formulario.',RESERVATION_DUPLICATE:'Ya existe una solicitud para ese teléfono y horario. Consulta la solicitud anterior.',RESERVATION_REQUEST_CONFLICT:'Esta solicitud ya fue enviada con otros datos. Consulta su enlace antes de volver a reservar.',RESERVATION_TABLE_REQUIRED:'Asigna una mesa antes de confirmar.',RESERVATION_TABLE_INVALID:'Revisa las mesas seleccionadas y su zona.',RESERVATION_PAIR_INVALID:'Esas mesas no tienen una unión permitida.',RESERVATION_CAPACITY_REVIEW:'Comprueba y registra la capacidad de las mesas unidas antes de confirmar.',RESERVATION_CAPACITY:'Las mesas no tienen capacidad para esas personas.',RESERVATION_OVERLAP:'Una de las mesas ya está reservada en ese horario, incluido el tiempo de preparación.',RESERVATION_STILL_SEATED:'La mesa sigue ocupada por otra reserva. Finaliza esa visita cuando realmente se desocupe.',RESERVATION_SPECIAL_GROUP:'Los grupos que usan más de dos mesas requieren revisión del encargado o administrador.',RESERVATION_TOLERANCE:'Todavía no se cumplen los minutos de tolerancia para marcar ausencia.',RESERVATION_ARRIVAL_TIME:'La llegada se registra el día de la visita, desde 15 minutos antes de la reserva.',RESERVATION_CANCEL:'Esta reserva ya no se puede cancelar desde aquí. Contacta al restaurante.',RESERVATION_FINAL:'Esta reserva ya está finalizada. Conservamos su historial.',RESERVATION_TRANSITION:'Ese cambio de estado no corresponde a la reserva.',RESERVATION_SEATED_CHANGE:'La visita está en curso. Finalízala antes de cambiar su asignación.'};
   if(error.message.includes('RESERVATION_FORBIDDEN'))throw new ForbiddenException('Tu cuenta no puede gestionar reservas.');
   if(error.message.includes('RESERVATION_NOT_FOUND'))throw new NotFoundException('No encontramos una reserva con ese acceso.');
   const key=Object.keys(messages).find(k=>error.message.includes(k));
   if(key==='RESERVATION_OVERLAP'||key==='RESERVATION_DUPLICATE'||key==='RESERVATION_STILL_SEATED')throw new ConflictException(messages[key]);
   throw new BadRequestException(key?messages[key]:'No pudimos guardar la reserva. Revisa los datos e inténtalo de nuevo.');
  }
  return data;
 }
 config(staff=false){return this.rpc('reservation_config',{p_staff:staff});}
 create(userId:string|null,manual:boolean,dto:CreateBookingDto){const {accessToken,website,...input}=dto;return this.rpc('reservation_create',{p_user:userId,p_manual:manual,p_input:input,p_hash:this.hash(accessToken)});}
 list(userId:string,staff:boolean,dto:BookingQueryDto){return this.rpc('reservation_list',{p_actor:userId,p_staff:staff,p_date:dto.date??null,p_status:dto.status??'',p_query:dto.q?.trim()??'',p_page:dto.page});}
 access(id:string,userId:string|null,token:string|null,cancel=false){return this.rpc('reservation_customer_access',{p_id:id,p_user:userId,p_hash:token?this.hash(token):null,p_cancel:cancel});}
 update(actor:string,id:string,dto:UpdateBookingDto){return this.rpc('reservation_update',{p_actor:actor,p_id:id,p_patch:dto});}
 async saveConfig(actor:string,dto:BookingConfigDto){
  const current=await this.config(true);
  if(dto.tables.some(t=>!current.tables.some((x:{number:number})=>x.number===t.number)||t.maximum<t.comfortable)||dto.pairs.some(p=>!current.pairs.some((x:{a:number;b:number})=>x.a===p.a&&x.b===p.b)))throw new BadRequestException('Revisa el mapa de mesas y sus capacidades.');
  return this.rpc('reservation_save_config',{p_actor:actor,p_config:dto});
 }
}
