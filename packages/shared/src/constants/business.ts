/**
 * Datos de contacto e identidad del negocio Costa Mar.
 * Fuente: menú público y material institucional (verificado 2026-10-10).
 */
export const BUSINESS = {
  name: 'Costa Mar Barra Cevichera',
  legalName: 'COSTAMAR LIMITADA',
  address: 'Av. Rafael Ariztía 220, Local 1, Quillota, Región de Valparaíso, Chile',
  city: 'Quillota',
  region: 'Región de Valparaíso',
  country: 'CL',
  phone: '+56962838538',
  phoneDisplay: '+56 9 6283 8538',
  email: 'costamarbarracevichera@gmail.com',
  whatsapp: 'https://api.whatsapp.com/send?phone=56962838538',
  instagram: 'https://www.instagram.com/costamarbarracevichera/',
  facebook: 'https://www.facebook.com/Costamar',
  // Subdominio del Club Costa Mar (PWA). URL centralizada para evitar
  // enlaces internos incorrectos a /club.
  clubUrl: 'https://club.restaurantecostamar.cl',
  // Horario anunciado; verificar vigencia antes del lanzamiento.
  hours: [
    { days: 'Lunes a Jueves', open: '12:00', close: '19:00' },
    { days: 'Viernes y Sábado', open: '12:00', close: '22:00' },
    { days: 'Domingo', open: '12:00', close: '18:00' },
  ],
} as const;
