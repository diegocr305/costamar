import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { CampaignProductRole } from '@costamar/shared';

export interface StaffProduct { productId: string; role: CampaignProductRole; name: string; isAvailable: boolean; }

export interface StaffCoupon {
  code: string;
  status: string;
  expiresAt: string | null;
  campaignName: string;
  campaignType: string;
  allowedProducts?: StaffProduct[];
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

export interface RedemptionEntry {
  id: string;
  createdAt: string;
  couponCode: string;
  campaignName: string;
  campaignType: string;
  memberName: string;
  memberCode: string | null;
  staffName: string;
  consumptionRef: string | null;
  products: unknown[];
  folio: string;
  tableLabel: string | null;
  orderRef: string | null;
  note: string | null;
}

export interface RedemptionConfirmation { id: string; folio: string; tableLabel: string; orderRef: string | null; note: string | null; createdAt: string; }

export interface RedemptionHistory {
  items: RedemptionEntry[];
  total: number;
  page: number;
  pageSize: number;
}

/** Llama a la API de personal del Club (validación y canje de cupones). */
@Injectable({ providedIn: 'root' })
export class ClubStaffService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/club/staff`;

  recent(tableLabel: string): Observable<RedemptionHistory> {
    let params = new HttpParams();
    if (tableLabel.trim()) params = params.set('tableLabel', tableLabel.trim());
    return this.http.get<RedemptionHistory>(`${this.base}/redemptions/recent`, { params });
  }

  history(date: string, query: string, page = 1, campaignId = ''): Observable<RedemptionHistory> {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (date) params = params.set('date', date);
    if (query.trim()) params = params.set('q', query.trim());
    if (campaignId) params = params.set('campaignId', campaignId);
    return this.http.get<RedemptionHistory>(`${this.base}/redemptions`, { params });
  }

  lookup(memberCode: string): Observable<StaffLookup> {
    return this.http.get<StaffLookup>(
      `${this.base}/lookup/${encodeURIComponent(memberCode)}`,
    );
  }

  redeem(
    code: string,
    tableLabel: string,
    products: unknown[] = [],
    orderRef = '',
    note = '',
  ): Observable<{ redeemed: boolean; redemption: RedemptionConfirmation }> {
    return this.http.post<{ redeemed: boolean; redemption: RedemptionConfirmation }>(`${this.base}/redeem`, {
      code,
      tableLabel,
      products,
      orderRef: orderRef.trim() || undefined,
      note: note.trim() || undefined,
    });
  }
}
