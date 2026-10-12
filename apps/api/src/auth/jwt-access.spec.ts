import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import type { SupabaseService } from '../supabase/supabase.service';
jest.mock('jwks-rsa',()=>({passportJwtSecret:()=>jest.fn()}));
describe('acceso vigente del equipo',()=>{
 function setup(data:string,error:unknown=null) {
  const rpc=jest.fn().mockResolvedValue({data,error});
  const strategy=new JwtStrategy({get:()=> 'https://example.supabase.co'} as unknown as ConfigService,{client:{rpc}} as unknown as SupabaseService);
  return {strategy,rpc};
 }
 it('retira acceso aunque el JWT conserve cashier',async()=>{
  const {strategy,rpc}=setup('customer');
  await expect(strategy.validate({sub:'staff-id',app_metadata:{role:'cashier'},iat:1,exp:2})).resolves.toMatchObject({role:'customer'});
  expect(rpc).toHaveBeenCalledWith('club_effective_role',{p_user_id:'staff-id'});
 });
 it('autoriza al nuevo mesero aunque su JWT todavía sea customer',async()=>{
  const {strategy}=setup('cashier');
  await expect(strategy.validate({sub:'staff-id',app_metadata:{role:'customer'},iat:1,exp:2})).resolves.toMatchObject({role:'cashier'});
 });
 it('rechaza el acceso si no puede comprobar permisos',async()=>{
  const {strategy}=setup('superadmin',{message:'unavailable'});
  await expect(strategy.validate({sub:'staff-id',app_metadata:{role:'superadmin'},iat:1,exp:2})).rejects.toBeInstanceOf(UnauthorizedException);
 });
});
