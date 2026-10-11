import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { catchError, of } from 'rxjs';
import type { CouponWithCampaign } from '@costamar/shared';
import { ClubService } from '../../core/club.service';

type Tab = 'disponibles' | 'proximos' | 'canjeados' | 'vencidos';
type State = 'loading' | 'loaded' | 'error' | 'offline';

@Component({
  selector: 'cm-cupones',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './cupones.component.html',
  styleUrl: './cupones.component.css',
})
export class CuponesComponent implements OnInit {
  private readonly club = inject(ClubService);

  protected readonly state = signal<State>('loading');
  protected readonly coupons = signal<CouponWithCampaign[]>([]);
  protected readonly tab = signal<Tab>('disponibles');

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'disponibles', label: 'Disponibles' },
    { key: 'proximos', label: 'Próximos' },
    { key: 'canjeados', label: 'Canjeados' },
    { key: 'vencidos', label: 'Vencidos' },
  ];

  /** Cupones del tab activo. */
  protected readonly visible = computed(() => {
    const now = Date.now();
    return this.coupons().filter((c) => {
      const notStarted = false; // "próximos" se usará cuando haya issued_at futuro
      const expired =
        c.status === 'expired' ||
        (c.expiresAt ? new Date(c.expiresAt).getTime() < now : false);
      switch (this.tab()) {
        case 'disponibles':
          return c.status === 'issued' && !expired && !notStarted;
        case 'proximos':
          return notStarted;
        case 'canjeados':
          return c.status === 'redeemed';
        case 'vencidos':
          return c.status === 'void' || expired;
      }
    });
  });

  ngOnInit(): void {
    this.load();
  }

  /** Revalidar al volver el foco a la PWA (estado siempre fresco). */
  @HostListener('document:visibilitychange')
  protected onVisibility(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.load();
    }
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
  }

  protected load(): void {
    this.state.set('loading');
    this.club
      .getCoupons()
      .pipe(
        catchError((err) => {
          this.state.set(err?.status === 0 ? 'offline' : 'error');
          return of(null);
        }),
      )
      .subscribe((data) => {
        if (!data) return;
        this.coupons.set(data);
        this.state.set('loaded');
      });
  }
}
