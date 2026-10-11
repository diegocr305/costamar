import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '@costamar/shared';
import { SeoService } from '../../core/seo.service';
import { GoogleReviewsComponent } from '../../shared/google-reviews/google-reviews.component';

@Component({
  selector: 'cm-home',
  standalone: true,
  imports: [RouterLink, GoogleReviewsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  private readonly seo = inject(SeoService);
  protected readonly business = BUSINESS;

  ngOnInit(): void {
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
}
