import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
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
}
