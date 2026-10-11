import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ClubService } from '../../core/club.service';

/**
 * Procesa el retorno de Google OAuth (PKCE):
 *  1. Intercambia el código por sesión.
 *  2. Consulta GET /club/me.
 *  3. Redirige a /mi-tarjeta si ya es socio, o a /completar-perfil si no.
 * En error, vuelve a /ingresar.
 */
@Component({
  selector: 'cm-auth-callback',
  standalone: true,
  template: `
    <section class="callback">
      <div class="spinner" aria-hidden="true"></div>
      <p role="status">{{ message() }}</p>
    </section>
  `,
  styles: [
    `
      .callback {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        color: var(--cm-muted);
        padding: 2rem;
      }
      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid rgba(18, 99, 160, 0.15);
        border-top-color: var(--cm-primary-dark);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .spinner {
          animation: none;
        }
      }
    `,
  ],
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly club = inject(ClubService);
  private readonly router = inject(Router);

  protected readonly message = signal('Validando tu identidad…');

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.handleOAuthCallback(window.location.href);
      this.message.set('Cargando tu membresía…');
      const me = await firstValueFrom(this.club.getMe());
      if (me.member) {
        await this.router.navigate(['/mi-tarjeta']);
      } else {
        await this.router.navigate(['/completar-perfil']);
      }
    } catch {
      this.message.set('No se pudo completar el inicio de sesión.');
      await this.router.navigate(['/ingresar']);
    }
  }
}
