import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/**
 * Procesa el retorno de Google OAuth: intercambia el código por sesión
 * (PKCE) y redirige al dashboard. En error, vuelve al login.
 */
@Component({
  selector: 'cm-auth-callback',
  standalone: true,
  template: `
    <div class="callback">
      <p>{{ message }}</p>
    </div>
  `,
  styles: [
    `
      .callback {
        text-align: center;
        margin: 6rem auto;
        color: #5a7382;
      }
    `,
  ],
})
export class AuthCallbackComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected message = 'Procesando inicio de sesión…';

  async ngOnInit(): Promise<void> {
    try {
      await this.auth.handleOAuthCallback(window.location.href);
      await this.router.navigate(['/dashboard']);
    } catch {
      this.message = 'No se pudo completar el inicio de sesión.';
      await this.router.navigate(['/login']);
    }
  }
}
