import type { UserRole } from '@costamar/shared';

export interface NavSection {
  label: string;
  path: string;
  /** Roles que pueden ver y acceder a esta sección */
  roles: UserRole[];
}

/**
 * Secciones del panel administrativo y los roles autorizados para cada una.
 * El menú se filtra según el rol del usuario; las rutas también se protegen
 * con roleGuard para que ocultar no sea la única defensa.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    roles: ['superadmin', 'admin', 'manager', 'kitchen', 'inventory', 'cashier'],
  },
  {
    label: 'Inventario',
    path: '/inventario',
    roles: ['superadmin', 'admin', 'inventory'],
  },
  {
    label: 'Carta',
    path: '/carta',
    roles: ['superadmin', 'admin', 'manager'],
  },
  {
    label: 'Pedidos',
    path: '/pedidos',
    roles: ['superadmin', 'admin', 'manager', 'kitchen', 'cashier'],
  },
  {
    label: 'Usuarios',
    path: '/usuarios',
    roles: ['superadmin', 'admin'],
  },
];

export function sectionsForRole(role: UserRole): NavSection[] {
  return NAV_SECTIONS.filter((s) => s.roles.includes(role));
}
