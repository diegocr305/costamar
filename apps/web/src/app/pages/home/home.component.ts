import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timeout } from 'rxjs';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '@costamar/shared';
import { SeoService } from '../../core/seo.service';
import { GoogleReviewsComponent } from '../../shared/google-reviews/google-reviews.component';
import type { CartaPublica, Product } from '@costamar/shared';
import { CartaService } from '../../core/carta.service';
import { mediaUrl } from '../../core/media-url';

interface Flavor { product: Product; category: string; categoryId: string; }

/** One photographed, available dish per category, with a maximum of six. */
export function selectHomeFlavors(carta: CartaPublica): Flavor[] {
  const priorities = ['cevich', 'compartir', 'crioll', 'pescad', 'postre', 'pasta'];
  const rank = (name: string) => {
    const i = priorities.findIndex(key => name.toLowerCase().includes(key));
    return i < 0 ? priorities.length : i;
  };
  return [...carta.categories]
    .filter(category => category.isActive)
    .sort((a, b) => rank(a.name) - rank(b.name) || a.position - b.position)
    .flatMap(category => {
      const product = category.products.find(p => p.isAvailable && p.images?.some(image => image.storagePath?.trim()));
      return product ? [{ product, category: category.name, categoryId: category.id }] : [];
    }).slice(0, 6);
}

@Component({
  selector: 'cm-home',
  standalone: true,
  imports: [RouterLink, GoogleReviewsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  private readonly seo = inject(SeoService);
  private readonly cartaService = inject(CartaService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly business = BUSINESS;
  protected readonly flavors = signal<Flavor[]>([]);
  protected readonly flavorState = signal<'loading' | 'loaded' | 'error'>('loading');
  protected readonly failedImages = signal<Set<string>>(new Set());

  /** Foto de ceviche en alta resolución (Supabase Storage) para el hero. */
  protected readonly heroImage =
    'assets/brand/home-hero.webp';

  ngOnInit(): void {
    this.loadFlavors();
    this.seo.update({
      title: 'Costa Mar Barra Cevichera — Cevichería peruana en Quillota',
      description:
        'Ceviches, cocina criolla y especialidades marinas en Quillota. Descubre la carta de Costa Mar Barra Cevichera.',
      path: '/',
    });

    // JSON-LD Restaurant con datos reales verificados. Sin ratings inventados.
    this.seo.setJsonLd({
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: this.business.name,
      servesCuisine: ['Peruana', 'Mariscos', 'Ceviche'],
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Av. Rafael Ariztía 220, Local 1',
        addressLocality: this.business.city,
        addressRegion: this.business.region,
        addressCountry: this.business.country,
      },
      telephone: this.business.phone,
      email: this.business.email,
      sameAs: [this.business.instagram, this.business.facebook],
    });
  }

  protected loadFlavors(): void {
    this.flavorState.set('loading');
    this.cartaService.getCarta().pipe(timeout(6000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: carta => { this.flavors.set(selectHomeFlavors(carta)); this.flavorState.set('loaded'); },
      error: () => this.flavorState.set('error'),
    });
  }

  protected photo(product: Product): string {
    return mediaUrl(product.images?.find(image => image.storagePath?.trim())?.storagePath);
  }

  protected photoFailed(id: string): void {
    this.failedImages.update(current => new Set([...current, id]));
  }
}
