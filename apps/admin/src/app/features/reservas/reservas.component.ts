import { Component,HostListener,OnInit,inject,signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient,HttpParams } from '@angular/common/http';
import { firstValueFrom,timeout } from 'rxjs';
import { RESERVATION_LABELS,RESERVATION_AREAS,chileLocalDateTime,chileLocalToIso,type Reservation,type ReservationConfig,type ReservationPage,type ReservationStatus } from '@costamar/shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';

@Component({selector:'cm-reservas-admin',standalone:true,imports:[FormsModule],templateUrl:'./reservas.component.html',styleUrl:'./reservas.component.css'})
export class ReservasAdminComponent implements OnInit {
 private readonly http=inject(HttpClient);private readonly auth=inject(AuthService);private readonly base=environment.apiUrl+'/reservations/admin';private request=0;
 protected config=signal<ReservationConfig|null>(null);protected settingsDraft=signal<ReservationConfig|null>(null);
 protected result=signal<ReservationPage>({items:[],total:0,page:1,pageSize:20});protected selected=signal<Reservation|null>(null);
 protected loading=signal(false);protected saving=signal(false);protected error=signal('');protected success=signal('');
 protected date=chileLocalDateTime(new Date().toISOString()).slice(0,10);protected status='';protected query='';
 protected newForm=false;protected newName='';protected newPhone='';protected newParty=2;protected newAt=chileLocalDateTime(new Date().toISOString());protected newNotes='';private newKey='';private newToken='';
 protected editAt='';protected editParty=2;protected editStatus:ReservationStatus='pending';protected editTables:number[]=[];protected capacity:number|null=null;protected staffNote='';
 protected editZone:'salon'|'terraza'|'barra'='salon';
 protected readonly labels=RESERVATION_LABELS;protected readonly areas=RESERVATION_AREAS;protected readonly statuses=Object.entries(RESERVATION_LABELS).map(([value,label])=>({value,label}));protected readonly days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
 protected readonly zones=['salon','terraza','barra'] as const;
 protected statusLabel(value:unknown){return RESERVATION_LABELS[value as ReservationStatus]??String(value);}
 protected isOwner(){return this.auth.user()?.role==='superadmin';}
 protected isCashier(){return this.auth.user()?.role==='cashier';}
 protected timestamp(value:string){return new Date(value).toLocaleString('es-CL',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'});}
 protected late(r:Reservation){return r.status==='confirmed'&&Date.now()>Date.parse(r.reservedAt)+r.toleranceMinutes*60000;}
 protected final(r:Reservation){return ['completed','cancelled','no_show'].includes(r.status);}
 protected transitions(r:Reservation){const allowed:Record<string,string[]>={pending:['pending','confirmed','cancelled'],confirmed:['confirmed','seated','cancelled','no_show'],seated:['seated','completed']};return this.statuses.filter(s=>(allowed[r.status]??[r.status]).includes(s.value));}
 async ngOnInit(){try{this.config.set(await firstValueFrom(this.http.get<ReservationConfig>(this.base+'/config')));}catch{this.error.set('No pudimos cargar el mapa de mesas.');}await this.load();}
 @HostListener('document:visibilitychange') protected onVisible(){if(document.visibilityState==='visible'&&!this.saving())void this.load(this.result().page);}
 protected async load(page=1){
  const request=++this.request;this.loading.set(true);this.error.set('');let params=new HttpParams().set('page',page).set('status',this.status).set('q',this.query.trim());if(this.date)params=params.set('date',this.date);
  try{const result=await firstValueFrom(this.http.get<ReservationPage>(this.base,{params}).pipe(timeout(10000)));if(request===this.request)this.result.set(result);}catch{if(request===this.request)this.error.set('No pudimos cargar la agenda. Reintenta.');}finally{if(request===this.request)this.loading.set(false);}
 }
 protected open(r:Reservation){this.selected.set(r);this.editAt=chileLocalDateTime(r.reservedAt);this.editParty=r.partySize;this.editStatus=r.status;this.editTables=[...r.tableNumbers];this.capacity=r.confirmedCapacity;this.staffNote=r.staffNote??'';this.editZone=r.assignedArea??(r.areaPreference==='any'?'salon':r.areaPreference);this.error.set('');this.success.set('');}
 protected toggleTable(number:number,checked:boolean){this.editTables=checked?[...this.editTables.filter(n=>this.config()?.tables?.find(t=>t.number===n)?.area===this.editZone),number].sort((a,b)=>a-b):this.editTables.filter(n=>n!==number);this.capacity=this.knownCapacity();}
 protected knownCapacity():number|null {const c=this.config();if(this.editTables.length===1)return c?.tables?.find(t=>t.number===this.editTables[0])?.maximum??null;if(this.editTables.length===2)return c?.pairs?.find(p=>p.enabled!==false&&p.a===this.editTables[0]&&p.b===this.editTables[1])?.capacity??null;return null;}
 protected needsReview(){return this.editTables.length>1&&this.knownCapacity()===null;}
 protected specialGroupChange(){const r=this.selected();return !!(r&&this.editTables.length>2&&this.isCashier()&&['confirmed','seated'].includes(this.editStatus)&&(r.status==='pending'||JSON.stringify(this.editTables)!==JSON.stringify(r.tableNumbers)||this.editParty!==r.partySize||Date.parse(chileLocalToIso(this.editAt)??'')!==Date.parse(r.reservedAt)||this.capacity!==r.confirmedCapacity));}
 protected tablesByArea(area:string){return this.config()?.tables?.filter(t=>t.area===area)??[];}
 protected async save(){
  const r=this.selected(),at=chileLocalToIso(this.editAt);if(!r||!at||this.saving())return;this.saving.set(true);this.error.set('');this.success.set('');
  const payload={status:this.editStatus,...(r.status==='seated'?{}:{partySize:this.editParty,reservedAt:at,tableNumbers:this.editTables}),staffNote:this.staffNote,...(this.capacity?{confirmedCapacity:this.capacity}:{})};
  try{const updated=await firstValueFrom(this.http.patch<Reservation>(this.base+'/'+r.id,payload));this.open(updated);await this.load(this.result().page);this.success.set('Reserva actualizada. El cambio y su responsable quedaron registrados.');}
  catch(e:unknown){this.error.set(this.message(e));}finally{this.saving.set(false);}
 }
 protected async create(){
  const at=chileLocalToIso(this.newAt);if(!at||!this.newName.trim()||!/^\d{8}$/.test(this.newPhone)||this.saving())return;
  if(!this.newKey){this.newKey=crypto.randomUUID();this.newToken=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');}
  this.saving.set(true);this.error.set('');
  try{const r=await firstValueFrom(this.http.post<Reservation>(this.base,{requestId:this.newKey,accessToken:this.newToken,customerName:this.newName.trim(),customerPhone:'+569'+this.newPhone,partySize:this.newParty,reservedAt:at,notes:this.newNotes,areaPreference:'any'}));this.newForm=false;this.newKey='';this.newToken='';this.date=chileLocalDateTime(at).slice(0,10);this.status='';this.query='';await this.load();this.open(r);this.success.set('Solicitud creada. Asigna las mesas y confirma cuando verifiques la disponibilidad.');}
  catch(e:unknown){this.error.set(this.message(e));}finally{this.saving.set(false);}
 }
 protected editSettings(){const c=this.config();if(c)this.settingsDraft.set(JSON.parse(JSON.stringify(c)));}
 protected async saveSettings(){const c=this.settingsDraft();if(!c||this.saving())return;this.saving.set(true);this.error.set('');try{this.config.set(await firstValueFrom(this.http.patch<ReservationConfig>(this.base+'/config',c)));this.settingsDraft.set(null);this.success.set('Configuración guardada. Las reservas existentes conservan sus tiempos previstos.');}catch(e:unknown){this.error.set(this.message(e));}finally{this.saving.set(false);}}
 protected eventLabel(value:string){return ({created:'Solicitud creada',staff_update:'Cambio del equipo',customer_cancel:'Cancelación del cliente'} as Record<string,string>)[value]??value;}
 private message(e:unknown){return (e as {error?:{message?:string}}).error?.message??'No pudimos guardar. Revisa los datos y reintenta.';}
}
