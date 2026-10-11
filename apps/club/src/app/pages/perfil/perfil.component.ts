import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ClubService } from '../../core/club.service';
import { MembershipStore } from '../../core/membership.store';

@Component({
  selector: 'cm-perfil',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css',
})
export class PerfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly club = inject(ClubService);
  private readonly router = inject(Router);
  protected readonly store = inject(MembershipStore);

  protected savingPrefs = signal(false);

  ngOnInit(): void {
    if (!this.store.member()) {
      this.store.load();
    }
  }

  async toggleEmail(value: boolean): Promise<void> {
    await this.save({ marketingEmail: value });
  }

  async toggleWhatsapp(value: boolean): Promise<void> {
    await this.save({ marketingWhatsapp: value });
  }

  private async save(patch: {
    marketingEmail?: boolean;
    marketingWhatsapp?: boolean;
  }): Promise<void> {
    this.savingPrefs.set(true);
    try {
      const updated = await firstValueFrom(this.club.updatePreferences(patch));
      this.store.preferences.set(updated);
    } finally {
      this.savingPrefs.set(false);
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.store.reset();
    await this.router.navigate(['/']);
  }
}
