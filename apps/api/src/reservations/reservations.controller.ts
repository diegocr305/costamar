import { Body,Controller,Get,Param,ParseUUIDPipe,Patch,Post,Query,UseGuards } from '@nestjs/common';
import { Throttle,ThrottlerGuard } from '@nestjs/throttler';
import { PublicRoute } from '../common/decorators/public-route.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReservationsService } from './reservations.service';
import { BookingAccessDto,BookingConfigDto,BookingQueryDto,CreateBookingDto,UpdateBookingDto } from './reservations.dto';
@Controller('reservations')
export class ReservationsController {
 constructor(private readonly reservations:ReservationsService){}
 @Get('config') @PublicRoute() config(){return this.reservations.config();}
 @Post('public') @PublicRoute() @UseGuards(ThrottlerGuard) @Throttle({default:{limit:5,ttl:300000}})
 publicCreate(@Body() dto:CreateBookingDto){return this.reservations.create(null,false,dto);}
 @Post('public/access') @PublicRoute() @UseGuards(ThrottlerGuard) @Throttle({default:{limit:30,ttl:60000}})
 publicAccess(@Body() dto:BookingAccessDto){return this.reservations.access(dto.id,null,dto.accessToken);}
 @Post('public/cancel') @PublicRoute() @UseGuards(ThrottlerGuard) @Throttle({default:{limit:10,ttl:60000}})
 publicCancel(@Body() dto:BookingAccessDto){return this.reservations.access(dto.id,null,dto.accessToken,true);}
 @Post('mine') create(@CurrentUser() user:AuthenticatedUser,@Body() dto:CreateBookingDto){return this.reservations.create(user.userId,false,dto);}
 @Get('mine') mine(@CurrentUser() user:AuthenticatedUser,@Query() dto:BookingQueryDto){return this.reservations.list(user.userId,false,dto);}
 @Post('mine/:id/cancel') cancel(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string){return this.reservations.access(id,user.userId,null,true);}
}
@Controller('reservations/admin') @Roles('superadmin','admin','manager','cashier')
export class ReservationsAdminController {
 constructor(private readonly reservations:ReservationsService){}
 @Get('config') config(){return this.reservations.config(true);}
 @Patch('config') @Roles('superadmin') saveConfig(@CurrentUser() user:AuthenticatedUser,@Body() dto:BookingConfigDto){return this.reservations.saveConfig(user.userId,dto);}
 @Get() list(@CurrentUser() user:AuthenticatedUser,@Query() dto:BookingQueryDto){return this.reservations.list(user.userId,true,dto);}
 @Post() create(@CurrentUser() user:AuthenticatedUser,@Body() dto:CreateBookingDto){return this.reservations.create(user.userId,true,dto);}
 @Patch(':id') update(@CurrentUser() user:AuthenticatedUser,@Param('id',ParseUUIDPipe) id:string,@Body() dto:UpdateBookingDto){return this.reservations.update(user.userId,id,dto);}
}
