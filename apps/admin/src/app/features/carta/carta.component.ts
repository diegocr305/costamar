import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';
import {
  CartaAdminService,
  type AdminCategory,
  type AdminProduct,
} from './carta-admin.service';

@Component({
  selector: 'cm-carta-admin',
  standalone: true,
  imports: [FormsModule, CurrencyPipe],
  templateUrl: './carta.component.html',
  styleUrl: './carta.component.css',
})
export class CartaAdminComponent implements OnInit {
  private readonly service = inject(CartaAdminService);

  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly products = signal<AdminProduct[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  // Formularios simples
  protected newCategoryName = '';
  protected newProduct = { categoryId: '', name: '', basePrice: 0 };

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.listCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.service.listProducts().subscribe({
          next: (prods) => {
            this.products.set(prods);
            this.loading.set(false);
          },
          error: () => this.fail(),
        });
      },
      error: () => this.fail(),
    });
  }

  protected addCategory(): void {
    if (!this.newCategoryName.trim()) return;
    this.service
      .createCategory({ name: this.newCategoryName.trim() })
      .subscribe({
        next: () => {
          this.newCategoryName = '';
          this.reload();
        },
        error: () => this.error.set('No se pudo crear la categoría.'),
      });
  }

  protected addProduct(): void {
    const p = this.newProduct;
    if (!p.categoryId || !p.name.trim() || p.basePrice < 0) return;
    this.service
      .createProduct({
        categoryId: p.categoryId,
        name: p.name.trim(),
        basePrice: p.basePrice,
      })
      .subscribe({
        next: () => {
          this.newProduct = { categoryId: '', name: '', basePrice: 0 };
          this.reload();
        },
        error: () => this.error.set('No se pudo crear el producto.'),
      });
  }

  protected toggleAvailability(prod: AdminProduct): void {
    this.service
      .updateProduct(prod.id, { isAvailable: !prod.is_available })
      .subscribe({
        next: () => this.reload(),
        error: () => this.error.set('No se pudo actualizar el producto.'),
      });
  }

  private fail(): void {
    this.loading.set(false);
    this.error.set('No se pudieron cargar los datos de la carta.');
  }
}
