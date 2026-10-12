import { isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { BUSINESS, RESERVATION_LABELS, RESERVATION_AREAS, chileLocalDateTime, chileLocalToIso, reservationSlots, type Reservation, type ReservationConfig, type ReservationPage, type ReservationArea } from '@costamar/shared';
import { environment } from '../../../environments/environment';
import { ClubService } from '../../core/club.service';
@Component({selector:'cm-reservas',standalone:true,imports:[FormsModule],templateUrl:'./reservas.component.html',styleUrl:'./reservas.component.css'})
export class ReservasComponent implements OnInit {
 private readonly http=inject(HttpClient);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);
 private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
 private readonly base=environment.apiUrl+'/reservations';
 private readonly club=inject(ClubService);
 protected readonly isClub=true;
 protected config=signal<ReservationConfig|null>(null);protected busy=signal(false);protected loading=signal(true);protected error=signal('');protected feedback=signal('');
 protected result=signal<Reservation|null>(null);protected mine=signal<ReservationPage>({items:[],total:0,page:1,pageSize:20});
 protected website='';protected name='';protected phone='';protected party=2;protected date=chileLocalDateTime(new Date().toISOString()).slice(0,10);protected time='';protected area:ReservationArea='any';protected notes='';
 protected readonly labels=RESERVATION_LABELS;protected readonly areas=RESERVATION_AREAS;protected readonly business=BUSINESS;
 protected readonly today=this.date;protected privateLink='';protected cancelId='';private token='';private requestId='';
 protected times(){const c=this.config();return c?reservationSlots(this.date,this.party,c):[];}
 protected changed(){if(!this.times().includes(this.time))this.time='';}
 protected timestamp(value:string){return new Date(value).toLocaleString('es-CL',{timeZone:'America/Santiago',dateStyle:'medium',timeStyle:'short'});}
 protected canCancel(r:Reservation){return ['pending','confirmed'].includes(r.status)&&Date.parse(r.reservedAt)>Date.now();}
 async ngOnInit(){
  try{
   this.config.set(await firstValueFrom(this.http.get<ReservationConfig>(this.base+'/config').pipe(timeout(10000))));
   if(!this.times().length){const d=new Date(this.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);this.date=d.toISOString().slice(0,10);}
   try{const me=await firstValueFrom(this.club.getMe());this.name=me.member?.fullName??'';const digits=(me.member?.phone??'').replace(/\D/g,'');this.phone=digits.startsWith('569')&&digits.length===11?digits.slice(3):'';}catch{}await this.loadMine();
   if(this.browser&&!this.isClub){const p=new URLSearchParams(this.route.snapshot.fragment??'');if(p.get('id')&&p.get('token')){this.requestId=p.get('id')!;this.token=p.get('token')!;await this.refreshPrivate();}}
  }catch{this.error.set('No pudimos cargar las reservas. Puedes reintentar.');}
  finally{this.loading.set(false);}
 }
 protected async loadMine(page=1){
  try{this.mine.set(await firstValueFrom(this.http.get<ReservationPage>(this.base+'/mine',{params:{page}}).pipe(timeout(10000))));}
  catch{this.error.set('No pudimos consultar tus reservas. Inténtalo de nuevo.');}
 }
 protected async submit(){
  const at=chileLocalToIso(this.date+'T'+this.time);
  if(this.busy()||!at||!this.name.trim()||!/^\d{8}$/.test(this.phone)||!this.times().includes(this.time))return;
  if(!this.requestId){this.requestId=crypto.randomUUID();this.token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');}
  this.busy.set(true);this.error.set('');
  if(!this.isClub)this.privateLink=window.location.origin+'/reservas#'+new URLSearchParams({id:this.requestId,token:this.token});
  const payload={requestId:this.requestId,accessToken:this.token,customerName:this.name.trim(),customerPhone:'+569'+this.phone,partySize:this.party,reservedAt:at,areaPreference:this.area,notes:this.notes,website:this.website};
  try{
   const r=await firstValueFrom(this.http.post<Reservation>(this.base+(this.isClub?'/mine':'/public'),payload).pipe(timeout(15000)));this.result.set(r);
   if(!this.isClub){const fragment=new URLSearchParams({id:r.id,token:this.token}).toString();this.privateLink=window.location.origin+'/reservas#'+fragment;await this.router.navigate([],{fragment,replaceUrl:true});}
   else await this.loadMine();
   this.feedback.set('Solicitud recibida. El equipo debe confirmar la disponibilidad.');
  }catch(e:unknown){this.error.set((e as {error?:{message?:string}}).error?.message??'No pudimos confirmar el envío. Reintenta con los mismos datos; evitaremos duplicar la solicitud.');}
  finally{this.busy.set(false);}
 }
 protected async refreshPrivate(){
  if(!this.token||!this.requestId)return;
  try{const r=await firstValueFrom(this.http.post<Reservation>(this.base+'/public/access',{id:this.requestId,accessToken:this.token}).pipe(timeout(10000)));this.result.set(r);if(this.browser)this.privateLink=window.location.origin+'/reservas#'+new URLSearchParams({id:r.id,token:this.token});}
  catch{this.error.set('No pudimos consultar esa solicitud. Revisa el enlace o contacta al restaurante.');}
 }
 protected async refresh(){this.error.set('');this.busy.set(true);if(this.isClub)await this.loadMine();else await this.refreshPrivate();this.busy.set(false);}
 protected async cancel(r:Reservation){
  if(this.busy())return;if(this.cancelId!==r.id){this.cancelId=r.id;return;}
  this.busy.set(true);this.error.set('');
  try{const updated=await firstValueFrom(this.http.post<Reservation>(this.base+(this.isClub?'/mine/'+r.id+'/cancel':'/public/cancel'),this.isClub?{}:{id:r.id,accessToken:this.token}).pipe(timeout(10000)));if(this.result()?.id===r.id)this.result.set(updated);if(this.isClub)await this.loadMine();this.feedback.set('Reserva cancelada.');this.cancelId='';}
  catch(e:unknown){this.error.set((e as {error?:{message?:string}}).error?.message??'No pudimos cancelar. Contacta al restaurante.');}
  finally{this.busy.set(false);}
 }
 protected newRequest(){this.result.set(null);this.requestId='';this.token='';this.privateLink='';this.feedback.set('');this.cancelId='';if(!this.isClub)void this.router.navigate([],{fragment:undefined,replaceUrl:true});}
 protected async copy(){try{await navigator.clipboard.writeText(this.privateLink);this.feedback.set('Enlace copiado. Guárdalo para consultar tu solicitud.');}catch{this.feedback.set('Selecciona y copia el enlace que aparece abajo.');}}
}
