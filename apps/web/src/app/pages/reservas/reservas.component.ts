import { ActionIconComponent } from '../../shared/action-icon.component';
import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BUSINESS, RESERVATION_LABELS, RESERVATION_AREAS, chileLocalDateTime, chileLocalToIso, reservationSlots, type Reservation, type ReservationConfig, type ReservationPage, type ReservationArea } from '@costamar/shared';
import { resolveApiUrl } from '../../core/api-url';
import { SeoService } from '../../core/seo.service';
@Component({selector:'cm-reservas',standalone:true,imports: [ActionIconComponent, FormsModule],templateUrl:'./reservas.component.html',styleUrl:'./reservas.component.css'})
export class ReservasComponent implements OnInit {
 private readonly http=inject(HttpClient);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);
 private readonly browser=isPlatformBrowser(inject(PLATFORM_ID));
 private readonly base=resolveApiUrl()+'/reservations';
 private readonly seo=inject(SeoService);
 protected readonly isClub=false;
 protected config=signal<ReservationConfig|null>(null);protected busy=signal(false);protected loading=signal(true);protected error=signal('');protected feedback=signal('');
 protected privateAccess=signal(false);protected mineLoading=signal(false);private mineRequest=0;protected result=signal<Reservation|null>(null);protected mine=signal<ReservationPage>({items:[],total:0,page:1,pageSize:20});
 protected website='';protected name='';protected phone='';protected party=2;protected date=chileLocalDateTime(new Date().toISOString()).slice(0,10);protected time='';protected area:ReservationArea='any';protected notes='';
 protected readonly labels=RESERVATION_LABELS;protected readonly areas=RESERVATION_AREAS;protected readonly business=BUSINESS;
 protected readonly today=this.date;protected privateLink='';protected cancelId='';private token='';private requestId='';
 private privateRequest=0;
 constructor(){
  inject(DestroyRef).onDestroy(()=>this.privateRequest++);
  if(this.browser)this.route.fragment.pipe(takeUntilDestroyed()).subscribe(fragment=>{
   if(!fragment){if(this.privateAccess())this.newRequest();return;}
   const params=new URLSearchParams(fragment),id=params.get('id'),token=params.get('token');
   if(!id||!token||(id===this.requestId&&token===this.token&&this.privateAccess()))return;
   this.requestId=id;this.token=token;this.result.set(null);this.feedback.set('');this.cancelId='';this.privateAccess.set(true);void this.refreshPrivate();
  });
 }
 protected times(){const c=this.config();return c?reservationSlots(this.date,this.party,c):[];}
 protected changed(){if(!this.times().includes(this.time))this.time='';}
 protected timestamp(value:string){return new Date(value).toLocaleString('es-CL',{timeZone:'America/Santiago',dateStyle:'medium',timeStyle:'short'});}
 protected canCancel(r:Reservation){return ['pending','confirmed'].includes(r.status)&&Date.parse(r.reservedAt)>Date.now();}
 async ngOnInit(){this.seo.update({title:'Reserva tu visita — Costa Mar',description:'Solicita tu reserva en Costa Mar Barra Cevichera, Quillota.',path:'/reservas'});
  this.loading.set(true);this.error.set('');
  try{
   this.config.set(await firstValueFrom(this.http.get<ReservationConfig>(this.base+'/config').pipe(timeout(10000))));
   if(!this.times().length){const d=new Date(this.date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);this.date=d.toISOString().slice(0,10);}

  }catch{this.error.set('No pudimos cargar las reservas. Puedes reintentar.');}
  finally{this.loading.set(false);}
 }
 protected async loadMine(page=1){
  const request=++this.mineRequest;this.mineLoading.set(true);
  try{const result=await firstValueFrom(this.http.get<ReservationPage>(this.base+'/mine',{params:{page}}).pipe(timeout(10000)));if(request===this.mineRequest)this.mine.set(result);}
  catch{if(request===this.mineRequest)this.error.set('No pudimos consultar tus reservas. Inténtalo de nuevo.');}
  finally{if(request===this.mineRequest)this.mineLoading.set(false);}
 }
 protected async submit(){
  const at=chileLocalToIso(this.date+'T'+this.time);
  if(this.busy()||!at||!this.name.trim()||!/^\d{8}$/.test(this.phone))return;
  if(!this.times().includes(this.time)){this.time='';this.error.set('Ese horario ya no cumple la anticipación mínima. Elige otra hora.');return;}
  if(!this.requestId){this.requestId=crypto.randomUUID();this.token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');}
  this.busy.set(true);this.error.set('');
  const request=++this.privateRequest;
  if(!this.isClub)this.privateLink=window.location.origin+'/reservas#'+new URLSearchParams({id:this.requestId,token:this.token});
  const payload={requestId:this.requestId,accessToken:this.token,customerName:this.name.trim(),customerPhone:'+569'+this.phone,partySize:this.party,reservedAt:at,areaPreference:this.area,notes:this.notes,website:this.website};
  try{
   const r=await firstValueFrom(this.http.post<Reservation>(this.base+(this.isClub?'/mine':'/public'),payload).pipe(timeout(15000)));if(request!==this.privateRequest)return;this.result.set(r);
   if(!this.isClub){this.privateAccess.set(true);const fragment=new URLSearchParams({id:r.id,token:this.token}).toString();this.privateLink=window.location.origin+'/reservas#'+fragment;await this.router.navigate([],{fragment,replaceUrl:true});}
   else await this.loadMine();
   this.feedback.set('Solicitud recibida. El equipo debe confirmar la disponibilidad.');
  }catch(e:unknown){if(request!==this.privateRequest)return;this.error.set((e as {error?:{message?:string}}).error?.message??'No pudimos confirmar el envío. Reintenta con los mismos datos; evitaremos duplicar la solicitud.');}
  finally{this.busy.set(false);}
 }
 protected async refreshPrivate(){
  if(!this.token||!this.requestId)return;
  const request=++this.privateRequest,id=this.requestId,token=this.token;this.error.set('');
  try{const r=await firstValueFrom(this.http.post<Reservation>(this.base+'/public/access',{id,accessToken:token}).pipe(timeout(10000)));if(request!==this.privateRequest)return;this.result.set(r);this.privateAccess.set(true);if(this.browser){const fragment=new URLSearchParams({id:r.id,token}).toString();this.privateLink=window.location.origin+'/reservas#'+fragment;await this.router.navigate([],{fragment,replaceUrl:true});}}
  catch{if(request===this.privateRequest)this.error.set('No pudimos consultar esa solicitud. Revisa el enlace o contacta al restaurante.');}
 }
 protected async refresh(){
  if(this.busy())return;this.error.set('');this.busy.set(true);
  try{
   if(this.isClub){const current=this.result();if(current)this.result.set(await firstValueFrom(this.http.get<Reservation>(this.base+'/mine/'+current.id).pipe(timeout(10000))));await this.loadMine(this.mine().page);}
   else await this.refreshPrivate();
  }catch{this.error.set('No pudimos consultar el estado. Inténtalo de nuevo.');}
  finally{this.busy.set(false);}
 }
 protected async cancel(r:Reservation){
  if(this.busy())return;if(this.cancelId!==r.id){this.cancelId=r.id;return;}
  this.busy.set(true);this.error.set('');
  try{const updated=await firstValueFrom(this.http.post<Reservation>(this.base+(this.isClub?'/mine/'+r.id+'/cancel':'/public/cancel'),this.isClub?{}:{id:r.id,accessToken:this.token}).pipe(timeout(10000)));if(this.result()?.id===r.id)this.result.set(updated);if(this.isClub)await this.loadMine();this.feedback.set('Reserva cancelada.');this.cancelId='';}
  catch(e:unknown){this.error.set((e as {error?:{message?:string}}).error?.message??'No pudimos cancelar. Contacta al restaurante.');}
  finally{this.busy.set(false);}
 }
 protected newRequest(){this.privateRequest++;this.privateAccess.set(false);this.error.set('');this.changed();this.result.set(null);this.requestId='';this.token='';this.privateLink='';this.feedback.set('');this.cancelId='';if(!this.isClub)void this.router.navigate([],{fragment:undefined,replaceUrl:true});}
 protected async copy(){try{await navigator.clipboard.writeText(this.privateLink);this.feedback.set('Enlace copiado. Guárdalo para consultar tu solicitud.');}catch{this.feedback.set('Selecciona y copia el enlace que aparece abajo.');}}
}
