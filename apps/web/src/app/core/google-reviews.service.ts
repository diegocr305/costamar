import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { GoogleReviewsSummary } from '@costamar/shared';
import { resolveApiUrl } from './api-url';

/**
 * Servicio de reseñas de Google.
 *
 * Estado actual: la API de Google Business Profile aún no está habilitada
 * (aprobación pendiente). getReviews() consulta el endpoint futuro
 * GET /api/v1/public/reviews; mientras no exista o no haya datos, devuelve
 * un resumen vacío (sin inventar reseñas ni calificaciones).
 *
 * Cuando se habilite la integración, el backend expondrá las reseñas con
 * OAuth seguro, paginación y caché. El frontend nunca maneja tokens.
 */
@Injectable({ providedIn: 'root' })
export class GoogleReviewsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = resolveApiUrl();

  private readonly empty: GoogleReviewsSummary = {
    averageRating: null,
    totalReviews: null,
    reviews: [],
  };

  getReviews(): Observable<GoogleReviewsSummary> {
    return this.http
      .get<GoogleReviewsSummary>(`${this.apiUrl}/public/reviews`)
      .pipe(catchError(() => of(this.empty)));
  }
}
