import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import type { CouponWithCampaign } from '@costamar/shared';
import { ClubService } from '../../core/club.service';
import { mediaUrl } from '../../core/media-url';

type Tab = 'disponibles' | 'canjeados' | 'vencidos';
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
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<State>('loading');
  protected readonly coupons = signal<CouponWithCampaign[]>([]);
  protected readonly tab = signal<Tab>('disponibles');

  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'disponibles', label: 'Disponibles' },
    { key: 'canjeados', label: 'Utilizados' },
    { key: 'vencidos', label: 'Vencidos' },
  ];

  /** Cupones del tab activo. */
  protected readonly visible = computed(() => this.forTab(this.tab()));
  protected count(tab: Tab): number { return this.forTab(tab).length; }
  private forTab(tab: Tab): CouponWithCampaign[] {
    const now = Date.now();
    return this.coupons().filter((c) => {
      const expired = c.status === 'issued' &&
        (c.expiresAt ? new Date(c.expiresAt).getTime() <= now : false);
      switch (tab) {
        case 'disponibles':
          return c.status === 'issued' && !expired;
        case 'canjeados':
          return c.status === 'redeemed';
        case 'vencidos':
          return c.status === 'void' || c.status === 'expired' || expired;
      }
    });
  }

  ngOnInit(): void {
    if (this.route.snapshot.queryParamMap.get('estado') === 'utilizados') this.tab.set('canjeados');
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
  protected usedLabel(c: CouponWithCampaign): string {
    if (!c.redeemedAt) return 'Regalo utilizado';
    return 'Utilizado el ' + new Intl.DateTimeFormat('es-CL', {timeZone:'America/Santiago',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(c.redeemedAt));
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
