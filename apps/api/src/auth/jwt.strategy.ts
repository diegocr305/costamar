import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import type { AuthenticatedUser, SupabaseJwtPayload } from './auth.types';
import { isValidRole } from '@costamar/shared';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Estrategia JWT que valida los tokens emitidos por Supabase Auth.
 *
 * El proyecto firma los JWT con claves asimétricas (ES256) expuestas vía
 * JWKS. La validación de firma usa la clave pública descargada y cacheada
 * desde el endpoint JWKS; la API no necesita ningún secreto para validar.
 *
 * El rol vigente se consulta en user_roles para que las suspensiones de
 * acceso tengan efecto incluso si el JWT todavía no ha expirado.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly supabase: SupabaseService) {
    const supabaseUrl = config.get<string>('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('Falta SUPABASE_URL en el entorno');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: 'authenticated',
      algorithms: ['ES256'],
      // Resuelve la clave pública desde el JWKS de Supabase, con caché.
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
    });
  }

  /**
   * Transforma el payload validado en el usuario autenticado.
   * Se ejecuta solo si la firma y expiración del token son válidas.
   */
  async validate(payload: SupabaseJwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Token sin identificador de usuario');
    }

    const {data:role,error}=await this.supabase.client.rpc('club_effective_role',{p_user_id:payload.sub});
    if(error) throw new UnauthorizedException('No pudimos verificar tu acceso.');
    return {
      userId: payload.sub,
      email: payload.email ?? '',
      // Nunca se asume un rol privilegiado desde el token.
      role: isValidRole(role) ? role : 'customer',
    };
  }
}
