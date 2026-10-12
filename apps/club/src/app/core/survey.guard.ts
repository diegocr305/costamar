import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { ClubService } from './club.service';
import { AuthService } from './auth.service';
import { SurveyFlowService, shouldOfferSurvey } from './survey-flow.service';
export const surveyGuard:CanActivateFn=async()=>{
 const club=inject(ClubService),auth=inject(AuthService),flow=inject(SurveyFlowService),router=inject(Router);
 // Angular puede ejecutar los guards en paralelo: esperar la sesión restaurada.
 if(!auth.ready()) await new Promise<void>(resolve=>{const check=()=>auth.ready()?resolve():setTimeout(check,30);check();});
 const user=auth.user();
 if(!user)return true;
 if(flow.wasShown(user.id)){void flow.flush(user.id);return true;}
 try {const me=await firstValueFrom(club.getMe().pipe(timeout(5000)));return shouldOfferSurvey(me)?router.createUrlTree(['/personalizar']):true;}
 catch {return true;}
};
