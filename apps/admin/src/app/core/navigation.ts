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
  { label: 'Campañas y beneficios', path: '/club/campanas', roles: ['superadmin', 'admin', 'manager'] },
  {
    label: 'Inicio',
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
  {
    label: 'Validar cupón',
    path: '/club/validar',
    roles: ['superadmin', 'admin', 'manager', 'cashier'],
  },
  {
    label: 'Historial de canjes',
    path: '/club/historial',
    roles: ['superadmin', 'admin', 'manager', 'cashier'],
  },
];

export function sectionsForRole(role: UserRole): NavSection[] {
  const order = ['/dashboard', '/club/validar', '/club/historial', '/club/campanas', '/carta', '/pedidos', '/inventario', '/usuarios'];
  return NAV_SECTIONS.filter((s) => s.roles.includes(role)).sort((a, b) => order.indexOf(a.path) - order.indexOf(b.path));
}
