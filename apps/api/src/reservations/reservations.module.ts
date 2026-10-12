import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ReservationsController,ReservationsAdminController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
@Module({imports:[ThrottlerModule.forRoot([{ttl:60000,limit:60}])],controllers:[ReservationsController,ReservationsAdminController],providers:[ReservationsService]})
export class ReservationsModule {}
