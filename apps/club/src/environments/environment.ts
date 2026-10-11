/**
 * Entorno del Club Costa Mar (desarrollo).
 * Solo claves PÚBLICAS. Nunca secretos ni service_role.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  supabaseUrl: 'https://pebdhasajkvsjttclbhf.supabase.co',
  // Publishable key (segura para frontend con RLS activo).
  supabaseAnonKey: 'sb_publishable_uuDvVXVRByWQ2mnuHOhJDw_PU7JzjZ2',
  // Ruta de retorno OAuth registrada en Supabase URL Configuration.
  authRedirectPath: '/auth/callback',
};
