import {
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, catchError, firstValueFrom, of } from 'rxjs';
import type { Campaign, CouponWithCampaign } from '@costamar/shared';
import { ClubService } from '../../core/club.service';
import { AuthService } from '../../core/auth.service';

type State = 'loading' | 'loaded' | 'error' | 'offline';

@Component({
  selector: 'cm-inicio',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './inicio.component.html',
  styleUrl: './inicio.component.css',
})
export class InicioComponent implements OnInit {
  private readonly club = inject(ClubService);
  private readonly auth = inject(AuthService);

  protected readonly state = signal<State>('loading');
  protected readonly campaigns = signal<Campaign[]>([]);
  protected readonly coupons = signal<CouponWithCampaign[]>([]);
  protected readonly firstName = signal('');

  protected readonly claiming = signal(false);
  protected readonly claimMsg = signal<string | null>(null);

  /** Campaña de fundadores activa, si existe. */
  protected readonly foundersCampaign = computed(() =>
    this.campaigns().find((c) => c.type === 'founders'),
  );

  /** Cupón del socio para la campaña de fundadores (si lo tiene). */
  protected readonly founderCoupon = computed(() => {
    const camp = this.foundersCampaign();
    if (!camp) return null;
    return (
      this.coupons().find((c) => c.campaignId === camp.id) ?? null
    );
  });

  /** Solo ofrecer reclamar si hay campaña activa y el socio NO tiene cupón. */
  protected readonly canClaimFounder = computed(
    () => !!this.foundersCampaign() && !this.founderCoupon(),
  );

  /** Beneficios disponibles para usar (issued y no vencidos). */
  protected readonly availableCoupons = computed(() => {
    const now = Date.now();
    return this.coupons().filter(
      (c) =>
        c.status === 'issued' &&
        (!c.expiresAt || new Date(c.expiresAt).getTime() >= now),
    );
  });

  ngOnInit(): void {
    const name = this.auth.user()?.fullName ?? '';
    this.firstName.set(name.split(' ')[0] ?? '');
    this.load();
  }

  /** Al volver el foco a la PWA, revalidar datos (vigencia del estado). */
  @HostListener('document:visibilitychange')
  protected onVisibility(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.load();
    }
  }

  protected load(): void {
    this.state.set('loading');
    forkJoin({
      campaigns: this.club.getCampaigns(),
      coupons: this.club.getCoupons(),
    })
      .pipe(
        catchError((err) => {
          this.state.set(err?.status === 0 ? 'offline' : 'error');
          return of(null);
        }),
      )
      .subscribe((data) => {
        if (!data) return;
        this.campaigns.set(data.campaigns);
        this.coupons.set(data.coupons);
        this.state.set('loaded');
      });
  }

  /** Reclama el beneficio de fundador y recarga para sincronizar el estado. */
  async claimFounder(): Promise<void> {
    this.claiming.set(true);
    this.claimMsg.set(null);
    try {
      await firstValueFrom(this.club.claimFounder());
      this.claimMsg.set('¡Listo! Tu beneficio está en "Mis cupones".');
      this.load();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      this.claimMsg.set(err?.error?.message ?? 'No se pudo reclamar el beneficio.');
    } finally {
      this.claiming.set(false);
    }
  }
}
