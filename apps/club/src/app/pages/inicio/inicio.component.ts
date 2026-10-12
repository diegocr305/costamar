import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import type { Campaign, CouponWithCampaign } from '@costamar/shared';
import { ClubService } from '../../core/club.service';
import { AuthService } from '../../core/auth.service';
import { mediaUrl } from '../../core/media-url';

type State = 'loading' | 'loaded' | 'error' | 'offline';
@Component({ selector: 'cm-inicio', standalone: true, imports: [RouterLink], templateUrl: './inicio.component.html', styleUrl: './inicio.component.css' })
export class InicioComponent implements OnInit {
  private readonly club = inject(ClubService);
  private readonly auth = inject(AuthService);
  protected readonly state = signal<State>('loading');
  protected readonly campaigns = signal<Campaign[]>([]);
  protected readonly coupons = signal<CouponWithCampaign[]>([]);
  protected readonly firstName = signal('');
  protected readonly profileComplete = signal(true);
  protected readonly hasUsed = computed(() => this.coupons().some(c => c.status === 'redeemed'));
  protected readonly availableCoupons = computed(() => this.coupons().filter(c => c.status === 'issued' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now())));
  protected readonly news = computed(() => this.campaigns().filter(c => !this.coupons().some(coupon => coupon.campaignId === c.id)));
  protected image(path?: string): string { return mediaUrl(path); }
  ngOnInit(): void { this.firstName.set(this.auth.user()?.fullName?.split(' ')[0] ?? ''); this.load(); }
  @HostListener('document:visibilitychange')
  protected onVisibility(): void { if (document.visibilityState === 'visible') this.load(); }
  protected load(): void {
    this.state.set('loading');
    forkJoin({ campaigns: this.club.getCampaigns(), coupons: this.club.getCoupons(), me: this.club.getMe() })
      .pipe(catchError(err => { this.state.set(err?.status === 0 ? 'offline' : 'error'); return of(null); }))
      .subscribe(data => {
        if (!data) return;
        this.campaigns.set(data.campaigns); this.coupons.set(data.coupons);
        this.profileComplete.set(!!(data.me.member?.phone && data.me.member?.birthDate));
        if (data.me.member?.fullName) this.firstName.set(data.me.member.fullName.split(' ')[0]);
        this.state.set('loaded');
      });
  }
}
