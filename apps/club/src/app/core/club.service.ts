import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  ClubConsent,
  ClubEnrollRequest,
  ClubMemberPreferences,
  ClubMeResponse,
} from '@costamar/shared';
import { environment } from '../../environments/environment';

/** Llamadas a la API del Club. El token lo adjunta el interceptor. */
@Injectable({ providedIn: 'root' })
export class ClubService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/club`;

  getMe(): Observable<ClubMeResponse> {
    return this.http.get<ClubMeResponse>(`${this.base}/me`);
  }

  enroll(payload: ClubEnrollRequest): Observable<ClubMeResponse> {
    return this.http.post<ClubMeResponse>(`${this.base}/enroll`, payload);
  }

  updatePreferences(
    prefs: Partial<ClubMemberPreferences>,
  ): Observable<ClubMemberPreferences> {
    return this.http.patch<ClubMemberPreferences>(
      `${this.base}/preferences`,
      prefs,
    );
  }

  getConsents(): Observable<ClubConsent[]> {
    return this.http.get<ClubConsent[]>(`${this.base}/consents`);
  }
}
