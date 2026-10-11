import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ClubService } from '../../core/club.service';

@Component({
  selector: 'cm-completar-perfil',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './completar-perfil.component.html',
  styleUrl: './completar-perfil.component.css',
})
export class CompletarPerfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly club = inject(ClubService);
  private readonly router = inject(Router);

  protected fullName = signal('');
  protected phone = signal('');
  protected acceptTerms = signal(false);
  protected acceptPrivacy = signal(false);
  protected marketingEmail = signal(false);
  protected marketingWhatsapp = signal(false);

  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    // Prefill con el nombre de Google si está disponible.
    const u = this.auth.user();
    if (u?.fullName) this.fullName.set(u.fullName);
  }

  protected canSubmit(): boolean {
    return (
      this.fullName().trim().length > 0 &&
      this.acceptTerms() &&
      this.acceptPrivacy() &&
      !this.saving()
    );
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.club.enroll({
          fullName: this.fullName().trim(),
          phone: this.phone().trim() || undefined,
          acceptTerms: this.acceptTerms(),
          acceptPrivacy: this.acceptPrivacy(),
          marketingEmail: this.marketingEmail(),
          marketingWhatsapp: this.marketingWhatsapp(),
        }),
      );
      await this.router.navigate(['/mi-tarjeta']);
    } catch {
      this.error.set('No pudimos completar tu registro. Inténtalo de nuevo.');
      this.saving.set(false);
    }
  }
}
