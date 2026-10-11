import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import type { ClubMember, ClubMemberPreferences } from '@costamar/shared';
import { ClubService } from './club.service';

/** Estados de la experiencia del socio. */
export type MembershipState =
  | 'idle'
  | 'loading'
  | 'incomplete' // autenticado pero sin membresía
  | 'active' // socio activo
  | 'error'
  | 'offline';

/**
 * Estado centralizado de la membresía. Carga GET /club/me y expone señales
 * para que las páginas reaccionen (perfil incompleto vs socio activo, etc.).
 */
@Injectable({ providedIn: 'root' })
export class MembershipStore {
  private readonly club = inject(ClubService);

  readonly state = signal<MembershipState>('idle');
  readonly member = signal<ClubMember | null>(null);
  readonly preferences = signal<ClubMemberPreferences | null>(null);

  readonly isActive = computed(() => this.state() === 'active');

  /** Carga la membresía del usuario autenticado. */
  load(): void {
    this.state.set('loading');
    this.club
      .getMe()
      .pipe(
        catchError((err) => {
          this.state.set(err?.status === 0 ? 'offline' : 'error');
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (!res) return;
        this.member.set(res.member);
        this.preferences.set(res.preferences);
        this.state.set(res.member ? 'active' : 'incomplete');
      });
  }

  reset(): void {
    this.member.set(null);
    this.preferences.set(null);
    this.state.set('idle');
  }
}
