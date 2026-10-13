import { ActionIconComponent } from '../action-icon.component';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GOOGLE_MAPS_URL, type GoogleReview } from '@costamar/shared';
import { GoogleReviewsService } from '../../core/google-reviews.service';

type RatingFilter = 'all' | 1 | 2 | 3 | 4 | 5;
type SortOrder = 'recent' | 'best' | 'worst';

@Component({
  selector: 'cm-google-reviews',
  standalone: true,
  imports: [ActionIconComponent, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './google-reviews.component.html',
  styleUrl: './google-reviews.component.css',
})
export class GoogleReviewsComponent implements OnInit {
  private readonly service = inject(GoogleReviewsService);

  protected readonly googleMapsUrl = GOOGLE_MAPS_URL;

  protected readonly averageRating = signal<number | null>(null);
  protected readonly totalReviews = signal<number | null>(null);
  protected readonly reviews = signal<GoogleReview[]>([]);

  // Controles (solo visibles cuando hay reseñas reales)
  protected readonly ratingFilter = signal<RatingFilter>('all');
  protected readonly sortOrder = signal<SortOrder>('recent');
  protected readonly onlyWithText = signal(false);

  protected readonly hasReviews = computed(() => this.reviews().length > 0);

  /** Reseñas tras aplicar filtros y orden. */
  protected readonly visibleReviews = computed(() => {
    let list = [...this.reviews()];

    const rf = this.ratingFilter();
    if (rf !== 'all') {
      list = list.filter((r) => r.rating === rf);
    }
    if (this.onlyWithText()) {
      list = list.filter((r) => r.text.trim().length > 0);
    }

    switch (this.sortOrder()) {
      case 'best':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'worst':
        list.sort((a, b) => a.rating - b.rating);
        break;
      case 'recent':
      default:
        list.sort(
          (a, b) =>
            new Date(b.publishedAt).getTime() -
            new Date(a.publishedAt).getTime(),
        );
    }
    return list;
  });

  protected readonly ratingFilters: RatingFilter[] = ['all', 5, 4, 3, 2, 1];

  ngOnInit(): void {
    this.service.getReviews().subscribe((summary) => {
      this.averageRating.set(summary.averageRating);
      this.totalReviews.set(summary.totalReviews);
      this.reviews.set(summary.reviews);
    });
  }

  protected setRatingFilter(f: RatingFilter): void {
    this.ratingFilter.set(f);
  }

  protected setSort(order: SortOrder): void {
    this.sortOrder.set(order);
  }

  protected toggleOnlyWithText(): void {
    this.onlyWithText.update((v) => !v);
  }

  /** Devuelve un arreglo de 5 posiciones para pintar estrellas. */
  protected stars(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map((n) => n <= Math.round(rating));
  }
}
