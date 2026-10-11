import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoData {
  title: string;
  description: string;
  /** Ruta relativa, ej. '/carta'. El dominio se añade solo si está definido. */
  path?: string;
}

/**
 * Servicio de SEO: título, meta description y Open Graph por página.
 * Compatible con SSR: usa Meta/Title de Angular y el DOCUMENT inyectado
 * para el JSON-LD (sin acceder a window/document globales).
 *
 * canonical/OG URL absolutas solo se emiten cuando hay dominio definitivo.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  // Dejar vacío hasta confirmar dominio definitivo en producción.
  private readonly baseUrl = '';

  update(data: SeoData): void {
    this.title.setTitle(data.title);
    this.meta.updateTag({ name: 'description', content: data.description });
    this.meta.updateTag({ property: 'og:title', content: data.title });
    this.meta.updateTag({
      property: 'og:description',
      content: data.description,
    });
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    if (this.baseUrl && data.path) {
      const absolute = `${this.baseUrl}${data.path}`;
      this.meta.updateTag({ property: 'og:url', content: absolute });
      this.setCanonical(absolute);
    }
  }

  /** Inserta un bloque JSON-LD en el head. Compatible con SSR. */
  setJsonLd(schema: Record<string, unknown>): void {
    const head = this.document.head;
    const existing = this.document.getElementById('cm-jsonld');
    if (existing) {
      existing.remove();
    }
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'cm-jsonld';
    script.textContent = JSON.stringify(schema);
    head.appendChild(script);
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector(
      "link[rel='canonical']",
    ) as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
