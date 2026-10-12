import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { CouponWithCampaign } from '@costamar/shared';
import { ClubService } from '../../core/club.service';
import { mediaUrl } from '../../core/media-url';

type Tab = 'disponibles' | 'proximos' | 'canjeados' | 'vencidos';
type State = 'loading' | 'loaded' | 'error' | 'offline';

@Component({
  selector: 'cm-cupones',
  standalone: true,
  imports: [RouterLink],
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
      const expired = c.status === 'issued' &&
        (c.expiresAt ? new Date(c.expiresAt).getTime() <= now : false);
      switch (this.tab()) {
        case 'disponibles':
          return c.status === 'issued' && !expired && !notStarted;
        case 'proximos':
          return notStarted;
        case 'canjeados':
          return c.status === 'redeemed';
        case 'vencidos':
          return c.status === 'void' || c.status === 'expired' || expired;
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

  /** URL de imagen de la campaña (Storage). */
  protected image(path?: string): string {
    return mediaUrl(path);
  }

  protected isAvailable(c: CouponWithCampaign): boolean {
    return c.status === 'issued' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now());
  }

  protected expiryLabel(c: CouponWithCampaign): string {
    if (!c.expiresAt) return '';
    const birthday = c.campaign.type === 'birthday';
    const date = new Date(new Date(c.expiresAt).getTime() - (birthday ? 1 : 0));
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric',
      ...(birthday ? {} : { hour: '2-digit', minute: '2-digit' }),
    }).format(date);
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
