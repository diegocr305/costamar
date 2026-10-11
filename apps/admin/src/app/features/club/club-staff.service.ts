import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StaffCoupon {
  code: string;
  status: string;
  expiresAt: string | null;
  campaignName: string;
  campaignType: string;
}

export interface StaffLookup {
  member: {
    memberCode: string;
    fullName: string;
    status: string;
    level: string;
  };
  coupons: StaffCoupon[];
}

/** Llama a la API de personal del Club (validación y canje de cupones). */
@Injectable({ providedIn: 'root' })
export class ClubStaffService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/club/staff`;

  lookup(memberCode: string): Observable<StaffLookup> {
    return this.http.get<StaffLookup>(
      `${this.base}/lookup/${encodeURIComponent(memberCode)}`,
    );
  }

  redeem(
    code: string,
    consumptionRef?: string,
    products: unknown[] = [],
  ): Observable<{ redeemed: boolean }> {
    return this.http.post<{ redeemed: boolean }>(`${this.base}/redeem`, {
      code,
      consumptionRef,
      products,
    });
  }
}
