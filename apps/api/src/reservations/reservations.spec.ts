import 'reflect-metadata';
import { ValidationPipe,ConflictException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateBookingDto,UpdateBookingDto } from './reservations.dto';
import { reservationSlots,type ReservationConfig } from '@costamar/shared';
import type { SupabaseService } from '../supabase/supabase.service';
describe('reservas',()=>{
 const pipe=new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true});
 const payload={requestId:'f9abb8b1-dd7b-4509-8328-cea33357e4e8',accessToken:'a'.repeat(64),customerName:'Cliente',customerPhone:'+56912345678',partySize:2,reservedAt:'2026-10-14T16:00:00Z'};
 it('no permite al público asignar identidad, mesas o estado',async()=>{
  await expect(pipe.transform({...payload,userId:'otro',status:'confirmed',tableNumbers:[1]},{type:'body',metatype:CreateBookingDto})).rejects.toThrow();
 });
 it('rechaza bots de honeypot, celular inválido y horarios sin zona',async()=>{
  for(const patch of [{website:'spam'},{customerPhone:'1234'},{reservedAt:'2026-10-14T13:00:00'}])await expect(pipe.transform({...payload,...patch},{type:'body',metatype:CreateBookingDto})).rejects.toThrow();
 });
 it('hash del acceso privado y actor del token, sin propagar claves a SQL',async()=>{
  const rpc=jest.fn().mockResolvedValue({data:{id:'reservation'},error:null});const s=new ReservationsService({client:{rpc}} as unknown as SupabaseService);
  await s.create('actor-del-token',false,payload);const args=rpc.mock.calls[0][1];expect(args.p_user).toBe('actor-del-token');expect(args.p_hash).toMatch(/^[a-f0-9]{64}$/);expect(args.p_hash).not.toBe(payload.accessToken);expect(args.p_input).not.toHaveProperty('accessToken');
 });
 it('conflicto de mesas devuelve 409 y mensaje útil',async()=>{
  const rpc=jest.fn().mockResolvedValue({data:null,error:{message:'RESERVATION_OVERLAP'}});const s=new ReservationsService({client:{rpc}} as unknown as SupabaseService);await expect(s.update('staff','id',{status:'confirmed',tableNumbers:[1,2]})).rejects.toBeInstanceOf(ConflictException);
 });
 it('preparación posterior a salida real devuelve conflicto, sin permitir llegada',async()=>{
  const rpc=jest.fn().mockResolvedValue({data:null,error:{message:'RESERVATION_PREPARING'}});
  const s=new ReservationsService({client:{rpc}} as unknown as SupabaseService);
  await expect(s.update('staff','id',{status:'seated'})).rejects.toBeInstanceOf(ConflictException);
 });
 it('rechaza tablas duplicadas o notas demasiado largas',async()=>{
  for(const patch of [{tableNumbers:[1,1]},{staffNote:'a'.repeat(501)}])await expect(pipe.transform(patch,{type:'body',metatype:UpdateBookingDto})).rejects.toThrow();
 });
 it('domingo cierra a las 18 y grupos grandes necesitan dos horas',()=>{
  const config:ReservationConfig={durationSmall:90,durationLarge:120,advanceMinutes:120,bufferMinutes:15,toleranceMinutes:15,hours:[{day:0,opens:'12:00',closes:'18:00',isOpen:true}]};
  expect(reservationSlots('2026-10-18',2,config,Date.parse('2026-10-17T12:00:00Z')).at(-1)).toBe('16:30');
  expect(reservationSlots('2026-10-18',6,config,Date.parse('2026-10-17T12:00:00Z')).at(-1)).toBe('16:00');
  expect(reservationSlots('2026-10-18',2,config,Date.parse('2026-10-18T18:00:00Z'))).toEqual([]);
 });
});
