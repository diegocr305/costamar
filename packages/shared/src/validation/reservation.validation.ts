import type { ReservationConfig } from '../types/reservations';
import { chileLocalToIso } from './chile-date.validation';
export function reservationSlots(date:string,party:number,config:ReservationConfig,now=Date.now()):string[]{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return [];
 const day=new Date(date+'T12:00:00Z').getUTCDay(),hours=config.hours.find(h=>h.day===day);
 if(!hours?.isOpen)return [];
 const minutes=(value:string)=>{const [h,m]=value.split(':').map(Number);return h*60+m;};
 const duration=party<=4?config.durationSmall:config.durationLarge,slots:string[]=[];
 for(let n=Math.ceil(minutes(hours.opens)/30)*30;n+duration<=minutes(hours.closes);n+=30){
  const time=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  const iso=chileLocalToIso(date+'T'+time);
  if(iso&&Date.parse(iso)>=now+config.advanceMinutes*60000)slots.push(time);
 }
 return slots;
}
