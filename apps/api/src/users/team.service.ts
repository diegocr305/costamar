import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TeamAccessDto } from './team.controller';

@Injectable()
export class TeamService {
 constructor(private readonly supabase: SupabaseService) {}
 async list() {
  const {data,error}=await this.supabase.client.rpc('club_list_team');
  if(error) throw new BadRequestException('No pudimos cargar el equipo.');
  return data;
 }
 async save(actorId:string,dto:TeamAccessDto) {
  const {data,error}=await this.supabase.client.rpc('club_set_team_access',{p_actor_id:actorId,p_email:dto.email,p_full_name:dto.fullName,p_is_active:dto.isActive});
  if(error) throw new BadRequestException(error.message.includes('TEAM_PROTECTED') ? 'Esta cuenta tiene un rol de administración y no se puede cambiar desde Equipo.' : 'No pudimos actualizar el acceso del equipo.');
  return data;
 }
}
