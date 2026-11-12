import { Component,HostListener,OnInit,inject,signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient,HttpParams } from '@angular/common/http';
import { firstValueFrom,timeout } from 'rxjs';
import { RESERVATION_LABELS,RESERVATION_AREAS,BUSINESS,chileLocalDateTime,chileLocalToIso,type Reservation,type ReservationConfig,type ReservationPage,type ReservationStatus,type CouponWhatsappReminder } from '@costamar/shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';

@Component({selector:'cm-reservas-admin',standalone:true,imports:[FormsModule],templateUrl:'./reservas.component.html',styleUrl:'./reservas.component.css'})
export class ReservasAdminComponent implements OnInit {
 private readonly http=inject(HttpClient);private readonly auth=inject(AuthService);private readonly base=environment.apiUrl+'/reservations/admin';private request=0;
 protected config=signal<ReservationConfig|null>(null);protected settingsDraft=signal<ReservationConfig|null>(null);
 protected result=signal<ReservationPage>({items:[],total:0,page:1,pageSize:20});protected selected=signal<Reservation|null>(null);
 protected loading=signal(false);protected saving=signal(false);protected error=signal('');protected success=signal('');
 protected readonly today=chileLocalDateTime(new Date().toISOString()).slice(0,10);
 // Primera opción: las reservas de hoy. La búsqueda y "Todas" salen de aquí.
 protected date=this.today;protected status='';protected query='';
 // Mensajes del panel de gestión: se muestran junto al botón Guardar, no arriba de la página.
 protected panelError=signal('');protected panelSuccess=signal('');
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
 protected preparing(r:Reservation){return r.status==='completed'&&!!r.releasedAt&&Date.now()<Date.parse(r.releasedAt)+r.bufferMinutes*60000;}
 protected readyAt(r:Reservation){return this.timestamp(new Date(Date.parse(r.releasedAt!)+r.bufferMinutes*60000).toISOString());}
 protected final(r:Reservation){return ['completed','cancelled','no_show'].includes(r.status);}
 protected transitions(r:Reservation){const allowed:Record<string,string[]>={pending:['pending','confirmed','cancelled'],confirmed:['confirmed','seated','cancelled','no_show'],seated:['seated','completed']};return this.statuses.filter(s=>(allowed[r.status]??[r.status]).includes(s.value));}
 protected reminders=signal<CouponWhatsappReminder[]>([]);protected remindersOpen=signal(false);protected remindersLoading=signal(false);
 async ngOnInit(){await this.loadConfig();await this.load();void this.loadReminders();}

 // ---------- Cupones por vencer: cola de WhatsApp para el equipo ----------
 /** Carga los cupones por vencer pendientes de avisar por WhatsApp. */
 protected async loadReminders(){
  this.remindersLoading.set(true);
  try{this.reminders.set(await firstValueFrom(this.http.get<CouponWhatsappReminder[]>(environment.apiUrl+'/club/staff/coupon-reminders').pipe(timeout(10000))));}
  catch{/* silencioso: la agenda es lo principal; el equipo puede reintentar */}
  finally{this.remindersLoading.set(false);}
 }
 protected reminderExpiry(iso:string){return new Date(iso).toLocaleDateString('es-CL',{timeZone:'America/Santiago',day:'numeric',month:'long'});}
 protected reminderDaysLeft(iso:string){return Math.max(0,Math.ceil((Date.parse(iso)-Date.now())/86400000));}
 /** Abre WhatsApp con el recordatorio del cupón pre-escrito para el socio. */
 protected reminderLink(r:CouponWhatsappReminder){
  const left=this.reminderDaysLeft(r.expiresAt);const when=this.reminderExpiry(r.expiresAt);
  const benefit=r.benefit||r.campaignName;
  const text=`Hola ${r.fullName.split(' ')[0]}, te saluda ${BUSINESS.name}. Te recordamos que tu beneficio del Club (${benefit}) vence el ${when}${left<=1?' (mañana)':` (en ${left} días)`}. Te esperamos para que lo disfrutes.`;
  return `https://wa.me/${r.phone.replace('+','')}?text=${encodeURIComponent(text)}`;
 }
 /** Marca el aviso como enviado y lo quita de la cola. */
 protected async markReminderSent(r:CouponWhatsappReminder){
  try{
   await firstValueFrom(this.http.post(environment.apiUrl+'/club/staff/coupon-reminders/'+r.reminderId+'/sent',{}).pipe(timeout(10000)));
   this.reminders.set(this.reminders().filter(x=>x.reminderId!==r.reminderId));
  }catch{this.error.set('No pudimos registrar el aviso. Inténtalo de nuevo.');}
 }
 protected async loadConfig(){this.error.set('');try{this.config.set(await firstValueFrom(this.http.get<ReservationConfig>(this.base+'/config').pipe(timeout(10000))));}catch{this.error.set('No pudimos cargar el mapa de mesas. Reintenta antes de asignar una mesa.');}}
 @HostListener('document:visibilitychange') protected onVisible(){if(document.visibilityState==='visible'&&!this.saving())void this.load(this.result().page);}
 protected async load(page=1){
  const request=++this.request;this.loading.set(true);this.error.set('');let params=new HttpParams().set('page',page).set('status',this.status).set('q',this.query.trim());
  // Al buscar por nombre, teléfono o RES-… se busca en todas las fechas.
  if(this.date&&!this.query.trim())params=params.set('date',this.date);
  try{const result=await firstValueFrom(this.http.get<ReservationPage>(this.base,{params}).pipe(timeout(10000)));if(request===this.request)this.result.set(result);}catch{if(request===this.request)this.error.set('No pudimos cargar la agenda. Reintenta.');}finally{if(request===this.request)this.loading.set(false);}
 }
 protected open(r:Reservation){this.selected.set(r);this.editAt=chileLocalDateTime(r.reservedAt);this.editParty=r.partySize;this.editStatus=r.status;this.editTables=[...r.tableNumbers];this.capacity=r.confirmedCapacity;this.staffNote=r.staffNote??'';this.editZone=r.assignedArea??(r.areaPreference==='any'?'salon':r.areaPreference);this.error.set('');this.success.set('');this.panelError.set('');this.panelSuccess.set('');
  // En pantallas angostas el panel queda debajo de la lista: llevarlo a la vista.
  if(typeof window!=='undefined'&&window.innerWidth<=1000)setTimeout(()=>document.getElementById('reserva-detalle')?.scrollIntoView({behavior:'smooth',block:'start'}),0);}
 protected toggleTable(number:number,checked:boolean){this.editTables=checked?[...this.editTables.filter(n=>this.config()?.tables?.find(t=>t.number===n)?.area===this.editZone),number].sort((a,b)=>a-b):this.editTables.filter(n=>n!==number);this.capacity=this.knownCapacity();}
 protected knownCapacity():number|null {const c=this.config();if(this.editTables.length===1)return c?.tables?.find(t=>t.number===this.editTables[0])?.maximum??null;if(this.editTables.length===2)return c?.pairs?.find(p=>p.enabled!==false&&p.a===this.editTables[0]&&p.b===this.editTables[1])?.capacity??null;return null;}
 protected needsReview(){return this.editTables.length>1&&this.knownCapacity()===null;}
 protected specialGroupChange(){const r=this.selected();return !!(r&&this.editTables.length>2&&this.isCashier()&&['confirmed','seated'].includes(this.editStatus)&&(r.status==='pending'||JSON.stringify(this.editTables)!==JSON.stringify(r.tableNumbers)||this.editParty!==r.partySize||Date.parse(chileLocalToIso(this.editAt)??'')!==Date.parse(r.reservedAt)||this.capacity!==r.confirmedCapacity));}
 protected tablesByArea(area:string){return this.config()?.tables?.filter(t=>t.area===area)??[];}
 protected async save(){
  const r=this.selected(),at=chileLocalToIso(this.editAt);if(!r||!at||this.saving())return;this.saving.set(true);this.panelError.set('');this.panelSuccess.set('');
  const payload={status:this.editStatus,...(r.status==='seated'?{}:{partySize:this.editParty,reservedAt:at,tableNumbers:this.editTables}),staffNote:this.staffNote,...(this.capacity?{confirmedCapacity:this.capacity}:{})};
  try{const updated=await firstValueFrom(this.http.patch<Reservation>(this.base+'/'+r.id,payload).pipe(timeout(15000)));this.open(updated);await this.load(this.result().page);this.panelSuccess.set(updated.status==='confirmed'?'Reserva confirmada. Avisa al cliente con el botón verde de WhatsApp.':'Reserva actualizada. El cambio y su responsable quedaron registrados.');}
  catch(e:unknown){this.panelError.set(this.message(e));}finally{this.saving.set(false);}
 }
 // ---------- Vistas rápidas: hoy primero, luego pendientes / todas / búsqueda ----------
 protected mode():'search'|'today'|'pending'|'all'|'custom'{
  if(this.query.trim())return 'search';
  if(this.date===this.today&&!this.status)return 'today';
  if(!this.date&&this.status==='pending')return 'pending';
  if(!this.date&&!this.status)return 'all';
  return 'custom';
 }
 protected showToday(){this.date=this.today;this.status='';this.query='';void this.load();}
 protected showPending(){this.date='';this.status='pending';this.query='';void this.load();}
 protected showAll(){this.date='';this.status='';this.query='';void this.load();}
 /** Misma clasificación que usa el servidor para ordenar, para rotular cada bloque. */
 private sectionOf(r:Reservation):{key:string;label:string}{
  const open=['pending','confirmed','seated'].includes(r.status),recent=Date.parse(r.reservedAt)>=Date.now()-86400000;
  if(r.status==='pending'&&recent)return {key:'pending',label:'Por confirmar'};
  if(['confirmed','seated'].includes(r.status)&&recent)return {key:'upcoming',label:'Confirmadas y próximas'};
  if(open)return {key:'stale',label:'Fecha pasada sin cerrar · cancela o marca “No asistió”'};
  return {key:'closed',label:'Historial · cerradas'};
 }
 /** Bloques consecutivos en el orden del servidor. Con una fecha elegida, un solo bloque sin título. */
 protected sections(){
  const items=this.result().items;
  if(this.date&&!this.query.trim())return items.length?[{key:'day',label:'',items}]:[];
  const out:{key:string;label:string;items:Reservation[]}[]=[];
  for(const r of items){const s=this.sectionOf(r),last=out[out.length-1];if(last&&last.key===s.key)last.items.push(r);else out.push({...s,items:[r]});}
  return out;
 }
 /** Solicitud pendiente cuya fecha ya pasó: el sistema no permite confirmarla sin cambiar la fecha. */
 protected pastPending(r:Reservation){return r.status==='pending'&&Date.parse(r.reservedAt)<Date.now()-15*60000;}
 /** Pendientes (para contactar y confirmar disponibilidad) y confirmadas (para avisar) tienen WhatsApp. */
 protected canWhatsapp(r:Reservation){return ['pending','confirmed'].includes(r.status)&&/^\+569\d{8}$/.test(r.customerPhone);}
 protected whatsappLabel(r:Reservation){return r.status==='pending'?'Contactar por WhatsApp':'Confirmar por WhatsApp';}
 /** Abre WhatsApp con el mensaje adecuado: consulta si está pendiente, confirmación si ya está confirmada. */
 protected whatsappLink(r:Reservation){
  const when=new Date(r.reservedAt).toLocaleString('es-CL',{timeZone:'America/Santiago',weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
  const people=`${r.partySize} ${r.partySize===1?'persona':'personas'}`,name=r.customerName.split(' ')[0];
  const text=r.status==='pending'
   ?`Hola ${name}, te saluda ${BUSINESS.name}. Recibimos tu solicitud de reserva para el ${when} para ${people} (referencia ${r.reference}). Estamos revisando la disponibilidad y te confirmamos en breve. ¿Sigue vigente?`
   :`Hola ${name}, te saluda ${BUSINESS.name}. Confirmamos tu reserva para el ${when} para ${people} (referencia ${r.reference}). Te esperamos. Si necesitas cambiar algo, respóndenos por aquí.`;
  return `https://wa.me/${r.customerPhone.replace('+','')}?text=${encodeURIComponent(text)}`;
 }
 protected async create(){
  const at=chileLocalToIso(this.newAt);if(!at||!this.newName.trim()||!/^\d{8}$/.test(this.newPhone)||this.saving())return;
  if(!this.newKey){this.newKey=crypto.randomUUID();this.newToken=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n=>n.toString(16).padStart(2,'0')).join('');}
  this.saving.set(true);this.error.set('');
  try{const r=await firstValueFrom(this.http.post<Reservation>(this.base,{requestId:this.newKey,accessToken:this.newToken,customerName:this.newName.trim(),customerPhone:'+569'+this.newPhone,partySize:this.newParty,reservedAt:at,notes:this.newNotes,areaPreference:'any'}).pipe(timeout(15000)));this.newForm=false;this.newKey='';this.newToken='';this.date=chileLocalDateTime(at).slice(0,10);this.status='';this.query='';await this.load();this.open(r);this.success.set('Solicitud creada. Asigna las mesas y confirma cuando verifiques la disponibilidad.');}
  catch(e:unknown){this.error.set(this.message(e));}finally{this.saving.set(false);}
 }
 protected editSettings(){const c=this.config();if(c)this.settingsDraft.set(JSON.parse(JSON.stringify(c)));}
 protected async saveSettings(){const c=this.settingsDraft();if(!c||this.saving())return;this.saving.set(true);this.error.set('');try{this.config.set(await firstValueFrom(this.http.patch<ReservationConfig>(this.base+'/config',c).pipe(timeout(15000))));this.settingsDraft.set(null);this.success.set('Configuración guardada. Las reservas existentes conservan sus tiempos previstos.');}catch(e:unknown){this.error.set(this.message(e));}finally{this.saving.set(false);}}
 protected eventLabel(value:string){return ({created:'Solicitud creada',staff_update:'Cambio del equipo',customer_cancel:'Cancelación del cliente'} as Record<string,string>)[value]??value;}
 private message(e:unknown){return (e as {error?:{message?:string}}).error?.message??'No pudimos guardar. Revisa los datos y reintenta.';}
}
