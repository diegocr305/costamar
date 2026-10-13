import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { makeStateKey, TransferState, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { Observable, of, tap } from 'rxjs';
import type { CartaPublica } from '@costamar/shared';
import { resolveApiUrl } from './api-url';
const CARTA_STATE = makeStateKey<CartaPublica>('cm-public-carta');

/**
 * Servicio que obtiene la carta pública desde la API.
 * La API devuelve solo productos disponibles (Propiedad 13).
 * La URL base se resuelve según plataforma (navegador vs SSR).
 */
@Injectable({ providedIn: 'root' })
export class CartaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = resolveApiUrl();
  private readonly transfer = inject(TransferState);
  private readonly platform = inject(PLATFORM_ID);

  getCarta(): Observable<CartaPublica> {
    if (isPlatformBrowser(this.platform) && this.transfer.hasKey(CARTA_STATE)) {
      const carta = this.transfer.get(CARTA_STATE, { categories: [] });
      this.transfer.remove(CARTA_STATE);
      return of(carta);
    }
    return this.http.get<CartaPublica>(`${this.apiUrl}/carta`).pipe(
      tap(carta => { if (isPlatformServer(this.platform)) this.transfer.set(CARTA_STATE, carta); }),
    );
  }
}
