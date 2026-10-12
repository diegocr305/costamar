import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SurveyDto } from './dto/survey.dto';
import { ClubService } from './club.service';
import type { SupabaseService } from '../supabase/supabase.service';
describe('encuesta opcional',()=>{
 it('admite respuestas parciales y aún no he visitado',async()=>{
  const dto=plainToInstance(SurveyDto,{action:'responded',preferences:{visitType:'not_visited',marketingEmail:false,marketingWhatsapp:false}});
  expect(await validate(dto)).toHaveLength(0);
 });
 it('rechaza identidad o telemetría aportadas por el cliente',async()=>{
  const dto=plainToInstance(SurveyDto,{action:'responded',userId:'otro',preferences:{surveyStatus:'responded'}});
  expect((await validate(dto,{whitelist:true,forbidNonWhitelisted:true})).length).toBeGreaterThan(0);
 });
 it('usa la identidad autenticada y conserva los permisos de comunicaciones',async()=>{
  const rpc=jest.fn().mockResolvedValue({data:{survey_status:'responded',visit_type:'not_visited',marketing_email:false,marketing_whatsapp:false},error:null});
  const service=new ClubService({client:{rpc}} as unknown as SupabaseService);
  await expect(service.surveyEvent('socio-autenticado','responded',{visitType:'not_visited',marketingEmail:false,marketingWhatsapp:false})).resolves.toMatchObject({surveyStatus:'responded',marketingEmail:false,marketingWhatsapp:false});
  expect(rpc).toHaveBeenCalledWith('club_survey_event',{p_user_id:'socio-autenticado',p_action:'responded',p_patch:{visit_type:'not_visited',marketing_email:false,marketing_whatsapp:false}});
 });
});
