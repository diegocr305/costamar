/**
 * Reseña de Google Business Profile.
 * Se poblará vía el backend (GET /api/v1/public/reviews) cuando Google
 * apruebe el acceso a la API. NUNCA se obtiene por scraping ni con
 * credenciales en el frontend.
 */
export interface GoogleReview {
  id: string;
  authorName: string;
  rating: number; // 1..5
  text: string;
  /** ISO date de la reseña */
  publishedAt: string;
  /** Respuesta del restaurante, si existe */
  reply?: {
    text: string;
    publishedAt: string;
  };
}

export interface GoogleReviewsSummary {
  /** Calificación promedio (1..5). null si no hay datos reales. */
  averageRating: number | null;
  /** Cantidad total de reseñas. null si no hay datos reales. */
  totalReviews: number | null;
  reviews: GoogleReview[];
}

/** Enlace oficial de la ficha de Costa Mar en Google Maps. */
export const GOOGLE_MAPS_URL = 'https://maps.app.goo.gl/EYVh6tqsw4tDTLVv9';
