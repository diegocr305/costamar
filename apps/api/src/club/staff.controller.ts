import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ClubStaffService } from './staff.service';
import { RedeemDto } from './dto/redeem.dto';

/**
 * API del personal (garzón/cajero/manager/admin) para validar y canjear
 * cupones del Club. Todas las rutas exigen rol autorizado.
 * El personal se identifica por su JWT; el canje queda auditado.
 */
@Controller('club/staff')
@Roles('superadmin', 'admin', 'manager', 'cashier')
export class ClubStaffController {
  constructor(private readonly staff: ClubStaffService) {}

  /** Al escanear el QR (member_code): datos mínimos del socio + sus cupones. */
  @Get('lookup/:memberCode')
  lookup(@Param('memberCode') memberCode: string) {
    return this.staff.lookupByMemberCode(memberCode);
  }

  /** Confirma el canje de un cupón. Registra quién, cuándo y qué. */
  @Post('redeem')
  redeem(@CurrentUser() user: AuthenticatedUser, @Body() dto: RedeemDto) {
    return this.staff.redeem(user.userId, dto);
  }
}
