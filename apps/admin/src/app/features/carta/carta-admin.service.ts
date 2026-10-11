import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminCategory {
  id: string;
  name: string;
  description: string | null;
  position: number;
  is_active: boolean;
}

export interface AdminProduct {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_available: boolean;
  position: number;
}

@Injectable({ providedIn: 'root' })
export class CartaAdminService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/carta`;

  listCategories(): Observable<AdminCategory[]> {
    return this.http.get<AdminCategory[]>(`${this.base}/categories`);
  }

  createCategory(body: Partial<AdminCategory>): Observable<AdminCategory> {
    return this.http.post<AdminCategory>(`${this.base}/categories`, body);
  }

  updateCategory(
    id: string,
    body: Partial<AdminCategory>,
  ): Observable<AdminCategory> {
    return this.http.patch<AdminCategory>(
      `${this.base}/categories/${id}`,
      body,
    );
  }

  deleteCategory(id: string): Observable<unknown> {
    return this.http.delete(`${this.base}/categories/${id}`);
  }

  listProducts(): Observable<AdminProduct[]> {
    return this.http.get<AdminProduct[]>(`${this.base}/products`);
  }

  createProduct(body: {
    categoryId: string;
    name: string;
    basePrice: number;
    description?: string;
  }): Observable<AdminProduct> {
    return this.http.post<AdminProduct>(`${this.base}/products`, body);
  }

  updateProduct(
    id: string,
    body: Partial<{ isAvailable: boolean; basePrice: number; name: string }>,
  ): Observable<AdminProduct> {
    return this.http.patch<AdminProduct>(`${this.base}/products/${id}`, body);
  }
}
