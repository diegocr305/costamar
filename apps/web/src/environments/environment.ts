/**
 * Configuración de entorno de la web pública.
 * En producción se reemplaza por environment.prod.ts.
 * Solo valores PÚBLICOS: nunca secretos ni service_role.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api/v1',
  // Base pública del Storage de Supabase (bucket "media").
  // Valor público del proyecto; nunca contiene secretos.
  supabaseUrl: 'https://pebdhasajkvsjttclbhf.supabase.co',
};
