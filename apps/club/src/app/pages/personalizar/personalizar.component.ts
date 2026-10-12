import { Component, Injector, OnInit, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { ClubService } from '../../core/club.service';
import { AuthService } from '../../core/auth.service';
import { MembershipStore } from '../../core/membership.store';
import { SurveyFlowService } from '../../core/survey-flow.service';

@Component({selector:'cm-personalizar',standalone:true,imports:[FormsModule],templateUrl:'./personalizar.component.html',styleUrl:'./personalizar.component.css'})
export class PersonalizarComponent implements OnInit {
 private readonly club=inject(ClubService);private readonly auth=inject(AuthService);private readonly router=inject(Router);
 private readonly flow=inject(SurveyFlowService);private readonly injector=inject(Injector);private readonly store=inject(MembershipStore);
 protected loading=signal(true);protected saving=signal(false);protected error=signal('');
 protected foods:string[]=[];protected commune='';protected visitType='';protected marketingEmail=false;protected marketingWhatsapp=false;
 protected readonly foodOptions=[{value:'seafood',label:'🐟 Ceviches y mariscos'},{value:'hot_dishes',label:'🥩 Carnes y platos calientes'},{value:'drinks',label:'🍹 Jugos y cócteles'},{value:'desserts',label:'🍰 Postres'}];
 protected readonly visitOptions=[{value:'family',label:'En familia'},{value:'couple',label:'En pareja'},{value:'friends',label:'Con amigos'},{value:'alone',label:'Por mi cuenta'},{value:'not_visited',label:'Aún no he visitado Costa Mar'},{value:'prefer_not_to_say',label:'Prefiero no responder'}];
 protected hasAnswers(){return !!(this.foods.length||this.visitType||this.commune.trim()||this.marketingEmail||this.marketingWhatsapp);}
 protected toggleFood(value:string,checked:boolean){this.foods=checked?[...new Set([...this.foods,value])]:this.foods.filter(f=>f!==value);}
 async ngOnInit(){
  try {
   const me=await firstValueFrom(this.club.getMe().pipe(timeout(5000)));
   if(!me.member){await this.router.navigate(['/completar-perfil']);return;}
   const p=me.preferences;this.store.member.set(me.member);this.store.preferences.set(p);
   this.foods=[...(p?.foodPreferences??[])];this.commune=p?.commune??'';this.visitType=p?.visitType??'';
   this.marketingEmail=p?.marketingEmail??false;this.marketingWhatsapp=p?.marketingWhatsapp??false;
   this.loading.set(false);
   afterNextRender(()=>{
    const id=this.auth.user()?.id;if(id)this.flow.markShown(id);
    // Registrar la vista después de renderizar las preguntas, sin bloquearlas.
    if(id)void this.flow.record(id,'viewed');
   },{injector:this.injector});
  }catch {const id=this.auth.user()?.id;if(id)this.flow.markShown(id);await this.router.navigate(['/inicio']);}
 }
 protected async skip(){
  if(this.saving())return;this.saving.set(true);
  const id=this.auth.user()?.id;if(id)this.flow.markShown(id);
  if(id){const result=await this.flow.record(id,'skipped');if(result)this.store.preferences.set(result);}
  await this.router.navigate(['/inicio']);
 }
 protected async submit(){
  if(this.saving()||!this.hasAnswers())return;this.saving.set(true);this.error.set('');
  try {
   this.store.preferences.set(await firstValueFrom(this.club.surveyEvent('responded',{commune:this.commune.trim(),foodPreferences:this.foods,visitType:this.visitType,marketingEmail:this.marketingEmail,marketingWhatsapp:this.marketingWhatsapp}).pipe(timeout(10000))));
   await this.router.navigate(['/inicio']);
  }catch {this.error.set('No pudimos guardar tus respuestas. Puedes reintentar o elegir Ahora no.');this.saving.set(false);}
 }
}
