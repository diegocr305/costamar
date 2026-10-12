import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClubService } from './club.service';
import { EnrollDto } from './dto/enroll.dto';
import { UpdatePreferencesDto } from './dto/preferences.dto';

/**
 * API del Club Costa Mar. Todas las rutas exigen JWT válido (guard global).
 * La identidad del socio SIEMPRE proviene del token (user.userId), nunca del
 * body: así se evita suplantación y registros a nombre de otro usuario.
 * Ninguna ruta crea roles administrativos.
 */
@Controller('club')
export class ClubController {
  constructor(private readonly club: ClubService) {}

  /** Membresía del usuario autenticado (null si aún no es socio). */
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    // Auditoría de acceso; no bloquea la respuesta.
    void this.club.recordLogin(user.userId);
    return this.club.getMe(user.userId);
  }

  /** Alta idempotente / completar perfil. */
  @Post('enroll')
  enroll(@CurrentUser() user: AuthenticatedUser, @Body() dto: EnrollDto) {
    return this.club.enroll(user.userId, user.email, dto);
  }

  /** Actualiza preferencias de comunicaciones del socio. */
  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.club.updatePreferences(user.userId, dto);
  }

  /** Consentimientos del propio socio. */
  @Get('consents')
  consents(@CurrentUser() user: AuthenticatedUser) {
    return this.club.getConsents(user.userId);
  }

  /** Campañas activas (para mostrar en la PWA). */
  @Get('campaigns')
  campaigns() {
    return this.club.listActiveCampaigns();
  }

  /** Sincroniza beneficios elegibles y devuelve cupones del socio autenticado. */
  @Get('coupons')
  myCoupons(@CurrentUser() user: AuthenticatedUser) {
    return this.club.getMyCoupons(user.userId);
  }

  /** Reclama el cupón de fundador (campaña activa, tope e idempotencia en BD). */
  @Post('founders/claim')
  claimFounder(@CurrentUser() user: AuthenticatedUser) {
    return this.club.claimFounderCoupon(user.userId);
  }
}
