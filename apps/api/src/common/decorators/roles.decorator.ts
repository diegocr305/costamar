import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@costamar/shared';

export const ROLES_KEY = 'requiredRoles';

/**
 * Declara los roles autorizados para acceder a una ruta.
 * El RolesGuard verifica que el rol del JWT esté entre los indicados.
 *
 * @example
 * @Roles('superadmin', 'admin')
 * @Post('users')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
