/**
 * Roles del sistema Costa Mar Platform.
 * El rol de un usuario determina sus permisos en la API y en la AdminApp.
 * La autenticación con Google no implica autorización administrativa.
 */
export const ROLES = [
  'superadmin',
  'admin',
  'manager',
  'kitchen',
  'inventory',
  'cashier',
  'customer',
] as const;

export type UserRole = (typeof ROLES)[number];

/** Roles con acceso al panel administrativo */
export const ADMIN_ROLES: UserRole[] = [
  'superadmin',
  'admin',
  'manager',
  'kitchen',
  'inventory',
  'cashier',
];

/** Roles con acceso de escritura a la carta */
export const CARTA_WRITE_ROLES: UserRole[] = ['superadmin', 'admin'];

/** Roles con acceso al inventario */
export const INVENTORY_ROLES: UserRole[] = ['superadmin', 'admin', 'inventory'];

/** Roles con acceso a reportes */
export const REPORT_ROLES: UserRole[] = ['superadmin', 'admin', 'manager'];
