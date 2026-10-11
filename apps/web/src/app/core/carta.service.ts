import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { CartaPublica } from '@costamar/shared';
import { resolveApiUrl } from './api-url';

/**
 * Servicio que obtiene la carta pública desde la API.
 * La API devuelve solo productos disponibles (Propiedad 13).
 * La URL base se resuelve según plataforma (navegador vs SSR).
 */
@Injectable({ providedIn: 'root' })
export class CartaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = resolveApiUrl();

  getCarta(): Observable<CartaPublica> {
    return this.http.get<CartaPublica>(`${this.apiUrl}/carta`);
  }
}
