import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClubAdminController } from './admin.controller';
import { ClubAdminService } from './admin.service';
import { RolesGuard } from '../common/guards/roles.guard';
import type { SupabaseService } from '../supabase/supabase.service';
import type { ExecutionContext } from '@nestjs/common';

describe('resumen del Club',()=>{
 it('consulta con el actor autenticado',async()=>{
  const rpc=jest.fn().mockResolvedValue({data:{date:'2026-10-12'},error:null});
  const service=new ClubAdminService({client:{rpc}} as unknown as SupabaseService);
  await expect(service.overview('actor-del-token')).resolves.toEqual({date:'2026-10-12'});
  expect(rpc).toHaveBeenCalledWith('club_admin_overview',{p_actor:'actor-del-token'});
 });
 it('deniega el resumen a roles de atención y manager',()=>{
  const guard=new RolesGuard(new Reflector());
  for(const role of ['cashier','manager','customer']){
   const context={getHandler:()=>ClubAdminController.prototype.overview,getClass:()=>ClubAdminController,switchToHttp:()=>({getRequest:()=>({user:{role}})})} as unknown as ExecutionContext;
   expect(()=>guard.canActivate(context)).toThrow(ForbiddenException);
  }
 });
 it('no convierte un error en cifras cero',async()=>{
  const rpc=jest.fn().mockResolvedValue({data:null,error:{message:'database unavailable'}});
  const service=new ClubAdminService({client:{rpc}} as unknown as SupabaseService);
  await expect(service.overview('actor')).rejects.toThrow('No pudimos cargar el resumen');
 });
});
