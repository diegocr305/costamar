import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import type { ClubOverview } from '@costamar/shared';
import { environment } from '../../../environments/environment';

@Component({selector:'cm-club-overview',standalone:true,imports:[RouterLink],templateUrl:'./club-overview.component.html',styleUrl:'./club-overview.component.css'})
export class ClubOverviewComponent implements OnInit,OnDestroy {
 private readonly http=inject(HttpClient);private request=0;
 protected summary=signal<ClubOverview|null>(null);protected loading=signal(false);protected error=signal('');
 protected readonly surveyStates=[{key:'notShown' as const,status:'not_shown',label:'Sin mostrar'},{key:'viewed' as const,status:'viewed',label:'Vista · sin respuesta'},{key:'skipped' as const,status:'skipped',label:'Omitida'},{key:'responded' as const,status:'responded',label:'Respondida'}];
 ngOnInit(){void this.load();}
 ngOnDestroy(){this.request++;}
 protected percent(part:number,total:number){return total?Math.round(part*100/total):0;}
 protected updated(value:string){return new Date(value).toLocaleString('es-CL',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'});}
 protected async load(){
  const request=++this.request;this.loading.set(true);this.error.set('');
  try{const data=await firstValueFrom(this.http.get<ClubOverview>(environment.apiUrl+'/club/admin/overview').pipe(timeout(10000)));if(request===this.request)this.summary.set(data);}
  catch{if(request===this.request)this.error.set('No pudimos actualizar el resumen. Puedes reintentar.');}
  finally{if(request===this.request)this.loading.set(false);}
 }
}
