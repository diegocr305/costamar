import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface TeamMember {email:string;fullName:string;isActive:boolean;hasAccount:boolean;}
@Component({selector:'cm-team',standalone:true,imports:[FormsModule],templateUrl:'./team.component.html',styleUrl:'./team.component.css'})
export class TeamComponent implements OnInit {
 private readonly http=inject(HttpClient);
 private readonly base=environment.apiUrl+'/team';
 protected members=signal<TeamMember[]>([]);
 protected loading=signal(false); protected saving=signal(false);
 protected error=signal(''); protected success=signal('');
 protected fullName=''; protected email=''; protected editing=false; protected query='';
 ngOnInit() { void this.load(); }
 protected filtered() { const q=this.query.toLowerCase().trim(); return this.members().filter(m=>(m.fullName+' '+m.email).toLowerCase().includes(q)); }
 protected edit(m:TeamMember) { this.fullName=m.fullName;this.email=m.email;this.editing=true;this.success.set(''); }
 protected reset() { this.fullName='';this.email='';this.editing=false; }
 protected async load() {
  this.loading.set(true);this.error.set('');
  try {this.members.set(await firstValueFrom(this.http.get<TeamMember[]>(this.base)));}
  catch {this.error.set('No pudimos cargar el equipo. Puedes reintentar.');}
  finally {this.loading.set(false);}
 }
 protected async save() {
  const existing=this.members().find(m=>m.email===this.email.toLowerCase().trim());
  await this.persist({email:this.email.trim().toLowerCase(),fullName:this.fullName.trim(),isActive:existing?.isActive??true});
 }
 protected async toggle(m:TeamMember) { await this.persist({...m,isActive:!m.isActive}); }
 private async persist(m:TeamMember | {email:string;fullName:string;isActive:boolean}) {
  if(this.saving()) return;
  this.saving.set(true);this.error.set('');this.success.set('');
  try { await firstValueFrom(this.http.post(this.base,{email:m.email,fullName:m.fullName,isActive:m.isActive})); this.reset(); await this.load(); this.success.set(m.isActive?'Acceso de atención guardado. Ingresa con ese correo de Google.':'Acceso de atención suspendido. Sus canjes anteriores se conservan.'); }
  catch(e:unknown) {this.error.set((e as {error?:{message?:string}}).error?.message??'No pudimos guardar el acceso.');}
  finally {this.saving.set(false);}
 }
}
