import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { CampaignAdmin, CampaignWrite, CouponStatus } from '@costamar/shared';
import { environment } from '../../../environments/environment';

export interface CampaignCouponRow {
  id: string; code: string; status: CouponStatus; memberName: string; memberCode: string | null;
  issuedAt: string; expiresAt: string | null; redeemedAt: string | null;
}
export interface CampaignCouponPage { items: CampaignCouponRow[]; total: number; page: number; pageSize: number; }

@Injectable({ providedIn: 'root' })
export class ClubCampaignsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/club/admin`;
  list() { return this.http.get<CampaignAdmin[]>(`${this.base}/campaigns`); }
  save(id: string | null, input: CampaignWrite & { slug?: string }) {
    return id ? this.http.patch<CampaignAdmin>(`${this.base}/campaigns/${id}`, input) : this.http.post<CampaignAdmin>(`${this.base}/campaigns`, input);
  }
  status(id: string, status: CampaignAdmin['status']) { return this.http.patch<CampaignAdmin>(`${this.base}/campaigns/${id}`, { status }); }
  coupons(id: string, status: string, query: string, page = 1) {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (status) params = params.set('status', status);
    if (query.trim()) params = params.set('q', query.trim());
    return this.http.get<CampaignCouponPage>(`${this.base}/campaigns/${id}/coupons`, { params });
  }
}
