import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CLUB_MIN_AGE, isAdult } from '@costamar/shared';
import { AuthService } from '../../core/auth.service';
import { ClubService } from '../../core/club.service';
import { shouldOfferSurvey } from '../../core/survey-flow.service';

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

  protected readonly minAge = CLUB_MIN_AGE;

  protected fullName = signal('');
  protected phone = signal('');
  protected birthDate = signal('');
  protected acceptTerms = signal(false);
  protected acceptPrivacy = signal(false);
  protected marketingEmail = signal(false);
  protected marketingWhatsapp = signal(false);

  protected saving = signal(false);
  protected error = signal<string | null>(null);

  ngOnInit(): void {
    const u = this.auth.user();
    if (u?.fullName) this.fullName.set(u.fullName);
    this.club.getMe().subscribe({
      next: ({ member }) => {
        if (!member) return;
        this.fullName.set(member.fullName);
        const digits = (member.phone ?? '').replace(/\D/g, '');
        this.phone.set(digits.length === 11 && digits.startsWith('569') ? digits.slice(3) : digits.length === 9 && digits.startsWith('9') ? digits.slice(1) : digits);
        this.birthDate.set(member.birthDate ?? '');
      },
      error: () => { /* El formulario sigue disponible para reintentar el alta. */ },
    });
  }

  /** Edad válida (≥18) si hay fecha. */
  protected ageValid(): boolean {
    const d = this.birthDate();
    return d.length > 0 && isAdult(d);
  }

  protected canSubmit(): boolean {
    return (
      this.fullName().trim().length > 0 &&
      /^[0-9]{8}$/.test(this.phone()) &&
      this.ageValid() &&
      this.acceptTerms() &&
      this.acceptPrivacy() &&
      !this.saving()
    );
  }

  async submit(): Promise<void> {
    if (!this.canSubmit()) {
      if (this.birthDate() && !this.ageValid()) {
        this.error.set(`Debes tener al menos ${this.minAge} años.`);
      }
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const me = await firstValueFrom(
        this.club.enroll({
          fullName: this.fullName().trim(),
          phone: '+569' + this.phone(),
          birthDate: this.birthDate(),
          acceptTerms: this.acceptTerms(),
          acceptPrivacy: this.acceptPrivacy(),
          marketingEmail: this.marketingEmail(),
          marketingWhatsapp: this.marketingWhatsapp(),
        }),
      );
      await this.router.navigate([shouldOfferSurvey(me) ? '/personalizar' : '/inicio']);
    } catch {
      this.error.set('No pudimos completar tu registro. Inténtalo de nuevo.');
      this.saving.set(false);
    }
  }
}
