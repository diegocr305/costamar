import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'cm-login',
  standalone: true,
  template: `
    <div class="login">
      <h1>Costa Mar — Administración</h1>
      <p class="login__sub">Acceso restringido al personal autorizado.</p>

      <button
        type="button"
        class="google"
        [disabled]="loading()"
        (click)="loginGoogle()"
      >
        {{ loading() ? 'Redirigiendo…' : 'Continuar con Google' }}
      </button>

      @if (error()) {
        <p class="login__error" role="alert">{{ error() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .login {
        max-width: 360px;
        margin: 6rem auto;
        padding: 2rem;
        text-align: center;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 2px 16px rgba(0, 0, 0, 0.1);
      }
      h1 {
        color: var(--cm-primary);
        font-size: 1.25rem;
        margin-bottom: 0.25rem;
      }
      .login__sub {
        color: #5a7382;
        margin-top: 0;
      }
      .google {
        margin-top: 1.5rem;
        padding: 0.75rem 1.5rem;
        width: 100%;
        border: 1px solid #ccc;
        background: #fff;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
      }
      .google:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .login__error {
        color: #c0392b;
        margin-top: 1rem;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  async loginGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.auth.loginWithGoogle();
    } catch {
      this.error.set('No se pudo iniciar sesión con Google. Intenta de nuevo.');
      this.loading.set(false);
    }
  }
}
