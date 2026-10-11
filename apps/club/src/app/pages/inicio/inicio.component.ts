import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { computed } from '@angular/core';
import type { Campaign } from '@costamar/shared';
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
  protected readonly firstName = signal('');

  protected readonly claiming = signal(false);
  protected readonly claimMsg = signal<string | null>(null);

  /** Campaña de fundadores activa, si existe. */
  protected readonly foundersCampaign = computed(() =>
    this.campaigns().find((c) => c.type === 'founders'),
  );

  ngOnInit(): void {
    const name = this.auth.user()?.fullName ?? '';
    this.firstName.set(name.split(' ')[0] ?? '');
    this.load();
  }

  protected load(): void {
    this.state.set('loading');
    this.club
      .getCampaigns()
      .pipe(
        catchError((err) => {
          this.state.set(err?.status === 0 ? 'offline' : 'error');
          return of(null);
        }),
      )
      .subscribe((data) => {
        if (!data) return;
        this.campaigns.set(data);
        this.state.set('loaded');
      });
  }

  /** Reclama el beneficio de fundador. */
  async claimFounder(): Promise<void> {
    this.claiming.set(true);
    this.claimMsg.set(null);
    try {
      await firstValueFrom(this.club.claimFounder());
      this.claimMsg.set('¡Listo! Tu beneficio está en "Mis cupones".');
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      this.claimMsg.set(err?.error?.message ?? 'No se pudo reclamar el beneficio.');
    } finally {
      this.claiming.set(false);
    }
  }
}
