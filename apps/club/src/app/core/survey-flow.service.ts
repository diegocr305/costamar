import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import type { ClubMeResponse, ClubMemberPreferences } from '@costamar/shared';
import { ClubService } from './club.service';
export function shouldOfferSurvey(me:ClubMeResponse):boolean {
 return !!(me.member?.status==='active' && me.member.phone && me.member.birthDate && (me.preferences?.surveyStatus??'not_shown')==='not_shown');
}
@Injectable({providedIn:'root'})
export class SurveyFlowService {
 private readonly club=inject(ClubService);
 private readonly shown=new Set<string>();
 private key(userId:string){return 'cm-survey-events-'+userId;}
 private pending(userId:string):('viewed'|'skipped')[]{
  try {const items=JSON.parse(localStorage.getItem(this.key(userId))??'[]');return Array.isArray(items)?items.filter((a):a is 'viewed'|'skipped'=>a==='viewed'||a==='skipped'):[];}catch{return [];}
 }
 private persist(userId:string,items:('viewed'|'skipped')[]){try {if(items.length)localStorage.setItem(this.key(userId),JSON.stringify(items));else localStorage.removeItem(this.key(userId));}catch{/* Navegación disponible aunque el almacenamiento esté restringido. */}}
 wasShown(userId:string) {return this.shown.has(userId)||this.pending(userId).length>0;}
 markShown(userId:string) {this.shown.add(userId);}
 async record(userId:string,action:'viewed'|'skipped'):Promise<ClubMemberPreferences|null>{
  this.markShown(userId);this.persist(userId,[...new Set([...this.pending(userId),action])]);
  try {const result=await firstValueFrom(this.club.surveyEvent(action).pipe(timeout(5000)));this.persist(userId,this.pending(userId).filter(a=>a!==action));return result;}catch{return null;}
 }
 async flush(userId:string){for(const action of this.pending(userId)){if(!await this.record(userId,action))break;}}
}
