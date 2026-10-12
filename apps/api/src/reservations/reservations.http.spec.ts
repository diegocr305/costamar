import { Global,Module,ValidationPipe,type CanActivate,type ExecutionContext,type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD,Reflector } from '@nestjs/core';
import { ReservationsModule } from './reservations.module';
import { SupabaseService } from '../supabase/supabase.service';
import { RolesGuard } from '../common/guards/roles.guard';
const rpc=jest.fn().mockResolvedValue({data:{id:'test-reservation',status:'pending'},error:null});
@Global() @Module({providers:[{provide:SupabaseService,useValue:{client:{rpc}}}],exports:[SupabaseService]}) class TestDatabaseModule {}
class TestIdentityGuard implements CanActivate {canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest();req.user={userId:'actor-del-token',role:req.headers['x-test-role']??'customer'};return true;}}
describe('HTTP reservas: DTO, roles y protección pública',()=>{
 let app:INestApplication,url:string;
 beforeAll(async()=>{const m=await Test.createTestingModule({imports:[TestDatabaseModule,ReservationsModule],providers:[{provide:APP_GUARD,useClass:TestIdentityGuard},{provide:APP_GUARD,useClass:RolesGuard}]}).compile();app=m.createNestApplication();app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));await app.listen(0,'127.0.0.1');url=await app.getUrl();});
 afterAll(async()=>{await app.close();});
 const payload={requestId:'f9abb8b1-dd7b-4509-8328-cea33357e4e8',accessToken:'a'.repeat(64),customerName:'Cliente',customerPhone:'+56912345678',partySize:2,reservedAt:'2027-10-14T16:00:00Z'};
 const headers={'Content-Type':'application/json'};
 it('consulta individual usa identidad del token y no acepta UUID inválido',async()=>{
  rpc.mockClear();
  expect((await fetch(url+'/reservations/mine/'+payload.requestId)).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith('reservation_customer_access',{p_id:payload.requestId,p_user:'actor-del-token',p_hash:null,p_cancel:false});
  rpc.mockClear();
  expect((await fetch(url+'/reservations/mine/id-invalido')).status).toBe(400);
  expect(rpc).not.toHaveBeenCalled();
 });
 it('rechaza asignación pública y restringe agenda/configuración',async()=>{
  expect((await fetch(url+'/reservations/public',{method:'POST',headers,body:JSON.stringify({...payload,status:'confirmed'})})).status).toBe(400);
  expect((await fetch(url+'/reservations/admin')).status).toBe(403);
  expect((await fetch(url+'/reservations/admin',{headers:{'x-test-role':'cashier'}})).status).toBe(200);
  expect((await fetch(url+'/reservations/admin/config',{method:'PATCH',headers:{...headers,'x-test-role':'cashier'},body:'{}'})).status).toBe(403);
 });
 it('limita solicitudes públicas antes de entrar a SQL',async()=>{
  const responses=[];for(let i=0;i<6;i++)responses.push((await fetch(url+'/reservations/public',{method:'POST',headers,body:JSON.stringify(payload)})).status);
  expect(responses).toContain(201);expect(responses.at(-1)).toBe(429);
  const args=rpc.mock.calls.find(c=>c[0]==='reservation_create')?.[1];expect(args.p_user).toBeNull();expect(args.p_manual).toBe(false);expect(args.p_input).not.toHaveProperty('accessToken');
 });
});
