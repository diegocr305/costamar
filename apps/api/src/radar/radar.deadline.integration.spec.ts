// Destructive fixtures are strictly limited to a disposable loopback PostgREST.
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { ConfigService } from '@nestjs/config';
import { RadarService } from './radar.service';
import { RadarQueryDto } from './radar.dto';
import { closingIn24Hours, resolveRadarDeadline } from '@costamar/shared';
const rest = process.env.RADAR_TEST_REST_URL;
if(rest && !['127.0.0.1','localhost'].includes(new URL(rest).hostname)) throw Error('Disposable loopback database required');
(rest ? describe : describe.skip)('Radar: filtro SQL antes de paginar y conteos reales', () => {
  const now = Date.parse('2026-10-12T23:00:00Z');
  let db:any,service:RadarService;
  const date=(minutes:number)=>new Date(now+minutes*60000).toISOString();
  const checked=async(p:any)=>{const r=await p;if(r.error)throw Error(r.error.message);return r.data};
  beforeAll(async()=>{
    const native=fetch;
    const client=createClient(rest!,'local-only',{auth:{persistSession:false},realtime:{transport:WebSocket as any},global:{fetch:(url,options)=>{const u=new URL(String(url));u.pathname=u.pathname.replace(/^\/rest\/v1/,'');const headers=new Headers(options?.headers);headers.delete('authorization');return native(u,{...options,headers})}}});
    db={client};service=new RadarService(db,new ConfigService());
    await checked(client.from('radar_opportunities').delete().neq('code',''));
    const rows=Array.from({length:45},(_,i)=>({source:i%2?'licitacion':'compra_agil',code:`999-${i+1}-COT26`,name:'Coffee prueba',official_status:'publicada',region:5,favorite:true,closes_raw:'',closes_at:date(30+i),profile_ids:[],items:[],documents:[],fingerprint:'test',raw_payload:{}}));
    const boundaries=[30,1439,1440,1500,-10,0].map((m,i)=>({...rows[0],code:`998-${i+1}-COT26`,name:'Borde',closes_at:date(m)}));
    const invalid=['','inválida','2026-02-30 10:00','2026-09-06 00:30','2026-04-04 23:30'].map((raw,i)=>({...rows[0],code:`997-${i+1}-COT26`,name:'Sin cierre',closes_raw:raw,closes_at:null}));
    await checked(client.from('radar_opportunities').insert([...rows,...boundaries,...invalid,
      {...rows[0],code:'996-1-COT26',name:'Civil Chile',closes_at:null,closes_raw:'2026-10-13 10:00'},
      {...rows[0],code:'996-2-COT26',name:'Confirmada',closes_at:date(1500),verified_closes_at:date(30)},
      {...rows[0],code:'996-3-COT26',name:'Región distinta',region:13},
      {...rows[0],code:'996-4-COT26',name:'Cerrada',official_status:'cerrada'},
      {...rows[0],code:'996-5-COT26',name:'No favorita',favorite:false},
    ].map(row=>({...row,search_text:row.name.toLowerCase()}))));
  });
  beforeEach(()=>jest.spyOn(Date,'now').mockReturnValue(now));
  afterEach(()=>jest.restoreAllMocks());
  it('excluye ahora/vencidas/25h/invalidas y acepta 30min,23h59 y24h',async()=>{
    const result=await service.list(Object.assign(new RadarQueryDto(),{q:'Borde',closing:'true'}));
    expect(result.total).toBe(3);expect(result.closingTotal).toBe(3);
    expect(result.items.every((r:any)=>closingIn24Hours(resolveRadarDeadline(r).iso,now))).toBe(true);
  });
  it('filtra todo el conjunto y cuenta antes de aplicar límite/página',async()=>{
    const a=await service.list(Object.assign(new RadarQueryDto(),{q:'Coffee',closing:'true',region:5,favorite:'true'}));
    const b=await service.list(Object.assign(new RadarQueryDto(),{q:'Coffee',closing:'true',region:5,favorite:'true',page:2}));
    const c=await service.list(Object.assign(new RadarQueryDto(),{q:'Coffee',closing:'true',region:5,favorite:'true',page:3}));
    expect(a.total).toBe(45);expect(a.closingTotal).toBe(45);expect([a.items.length,b.items.length,c.items.length]).toEqual([20,20,5]);
    const merged=[...a.items,...b.items,...c.items];expect(new Set(merged.map((r:any)=>r.id)).size).toBe(45);
    expect(merged.map((r:any)=>r.effective_closes_at)).toEqual([...merged].sort((x:any,y:any)=>Date.parse(x.effective_closes_at)-Date.parse(y.effective_closes_at)).map((r:any)=>r.effective_closes_at));
  });
  it.each([['compra_agil',23],['licitacion',22]])('combina región, texto, favoritas y fuente %s',async(source,total)=>{
    const r=await service.list(Object.assign(new RadarQueryDto(),{q:'Coffee',region:5,favorite:'true',source,closing:'true'}));expect(r.total).toBe(total);
  });
  it('respeta estado adicional y deja visibles los cierres no disponibles fuera de 24h',async()=>{
    const closed=await service.list(Object.assign(new RadarQueryDto(),{status:'cerrada',closing:'true'}));expect(closed.total).toBe(0);
    const absent=await service.list(Object.assign(new RadarQueryDto(),{q:'Sin cierre'}));expect(absent.total).toBe(5);expect(absent.unknownCloseTotal).toBe(5);
  });
  it('calcula fechas civiles de Chile sin modificar columnas históricas y prioriza confirmadas',async()=>{
    const local=await service.list(Object.assign(new RadarQueryDto(),{q:'Civil Chile',closing:'true'}));expect(local.total).toBe(1);expect(local.items[0].closes_at).toBeNull();expect(local.items[0].deadline_basis).toBe('chile_local');
    const verified=await service.list(Object.assign(new RadarQueryDto(),{q:'Confirmada',closing:'true'}));expect(verified.total).toBe(1);expect(verified.items[0].deadline_basis).toBe('verified');
  });
  it('conserva notas/favoritos y devuelve la fecha efectiva después de guardar',async()=>{
    const list=await service.list(Object.assign(new RadarQueryDto(),{q:'Civil Chile'}));const row=list.items[0];
    const saved=await service.tracking('11111111-1111-4111-8111-111111111111',row.id,{expected_updated_at:'none',notes:'Nota de prueba',favorite:false,verified_closes_at:date(30)});
    if(!saved) throw Error('Tracking did not return the saved opportunity');
    expect(saved.notes).toBe('Nota de prueba');expect(saved.favorite).toBe(false);expect(saved.deadline_basis).toBe('verified');expect(saved.closes_raw).toBe(row.closes_raw);
    await expect(service.tracking('11111111-1111-4111-8111-111111111111',row.id,{expected_updated_at:'none',notes:'No sobrescribir'})).rejects.toThrow('La ficha cambió');
  });
});
