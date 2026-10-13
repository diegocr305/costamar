import { CurrencyPipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  afterEveryRender,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { CartaPublica, Product } from '@costamar/shared';
import { CartaService } from '../../core/carta.service';
import { SeoService } from '../../core/seo.service';
import { mediaUrl } from '../../core/media-url';

type LoadState = 'loading' | 'loaded' | 'error';

@Component({
  selector: 'cm-carta',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './carta.component.html',
  styleUrl: './carta.component.css',
})
export class CartaComponent implements OnInit {
  private readonly cartaService = inject(CartaService);
  private readonly seo = inject(SeoService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private lastFragment: string | null = null;

  constructor() {
    afterEveryRender(() => {
      const fragment = this.route.snapshot.fragment;
      if (this.isBrowser && this.state() === 'loaded' && fragment && fragment !== this.lastFragment) {
        const target = this.document.getElementById(fragment);
        if (target) { target.scrollIntoView({ block: 'start' }); this.lastFragment = fragment; }
      }
    });
  }

  protected readonly state = signal<LoadState>('loading');
  protected readonly carta = signal<CartaPublica | null>(null);

  /** Lista de categorías para la navegación por anclas. */
  protected readonly categoryNav = computed(
    () =>
      this.carta()?.categories.map((c) => ({
        id: c.id,
        name: c.name,
        anchor: this.anchorId(c.id),
      })) ?? [],
  );

  ngOnInit(): void {
    this.seo.update({
      title: 'Carta — Costa Mar Barra Cevichera',
      description:
        'Explora la carta de Costa Mar: ceviches, pescados, mariscos y cocina criolla peruana en Quillota.',
      path: '/carta',
    });
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.cartaService
      .getCarta()
      .pipe(
        catchError(() => {
          this.state.set('error');
          return of(null);
        }),
      )
      .subscribe((data) => {
        if (data) {
          this.carta.set(data);
          this.state.set('loaded');
        }
      });
  }

  /** Platos con foto: se muestran como tarjetas destacadas. */
  protected withPhoto(products: Product[]): Product[] {
    return products.filter((p) => (p.images?.length ?? 0) > 0);
  }

  /** Platos sin foto: se muestran en lista compacta elegante. */
  protected withoutPhoto(products: Product[]): Product[] {
    return products.filter((p) => (p.images?.length ?? 0) === 0);
  }

  protected imageUrl(p: Product): string {
    return mediaUrl(p.images?.[0]?.storagePath);
  }

  protected anchorId(categoryId: string): string {
    return `cat-${categoryId}`;
  }

  /** Desplaza suavemente a la categoría. SSR-safe (usa DOCUMENT inyectado). */
  protected scrollToCategory(categoryId: string): void {
    if (!this.isBrowser) {
      return;
    }
    const el = this.document.getElementById(this.anchorId(categoryId));
    const reduced = this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  }
}
