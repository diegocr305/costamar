import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
interface Member {fullName:string;memberCode:string;commune:string;foodPreferences:string[];visitType:string;birthdayMonth:boolean;marketingEmail:boolean;marketingWhatsapp:boolean;email:string|null;phone:string|null;}
@Component({selector:'cm-club-members',standalone:true,imports:[FormsModule],templateUrl:'./club-members.component.html',styleUrl:'./club-members.component.css'})
export class ClubMembersComponent implements OnInit {
 private readonly http=inject(HttpClient); private request=0;
 protected result=signal<{items:Member[];total:number;page:number;pageSize:number}>({items:[],total:0,page:1,pageSize:20});
 protected loading=signal(false);protected error=signal('');
 protected birthday=false;protected food='';protected visit='';protected commune='';protected channel='all';protected q='';
 protected foodLabel(value:string) {return ({seafood:'Ceviches y mariscos',hot_dishes:'Carnes y platos calientes',drinks:'Jugos y cócteles',desserts:'Postres'} as Record<string,string>)[value]??value;}
 protected visitLabel(value:string) {return ({family:'En familia',couple:'En pareja',friends:'Con amigos',alone:'Por mi cuenta',prefer_not_to_say:'Prefiero no responder'} as Record<string,string>)[value]??'Sin responder';}
 ngOnInit(){void this.load();}
 protected preset(type:string) {this.birthday=type==='birthday';this.food=type==='seafood'?'seafood':'';this.visit=type==='family'?'family':'';void this.load();}
 protected async load(page=1) {
  const request=++this.request;this.loading.set(true);this.error.set('');
  const params=new HttpParams().set('birthday',String(this.birthday)).set('food',this.food).set('visit',this.visit).set('commune',this.commune.trim()).set('channel',this.channel).set('q',this.q.trim()).set('page',page);
  try {const result=await firstValueFrom(this.http.get<{items:Member[];total:number;page:number;pageSize:number}>(environment.apiUrl+'/club/admin/members',{params}));if(request===this.request)this.result.set(result);}
  catch {if(request===this.request)this.error.set('No pudimos cargar los socios. Inténtalo de nuevo.');}
  finally {if(request===this.request)this.loading.set(false);}
 }
}
