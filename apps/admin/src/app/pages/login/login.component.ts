import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'cm-login', standalone: true,
  template: `
    <main class="login-page"><section class="login">
      <img src="assets/brand/costamar-logo.png" alt="Costa Mar Barra Cevichera" width="100" height="100" />
      <span class="eyebrow">Equipo Costa Mar</span><h1>Una buena atención<br />empieza contigo.</h1>
      <p>Escanea las tarjetas del Club, confirma sus regalos y consulta los canjes del día.</p>
      <button type="button" class="google" [disabled]="loading()" (click)="loginGoogle()">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.2C12.3 13.3 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.4 5.7c4.3-4 6.8-9.9 6.8-17.4z"/><path fill="#FBBC05" d="M10.4 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.8l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.6l-7.4-5.7c-2 1.4-4.7 2.3-8.1 2.3-6.3 0-11.7-3.8-13.6-9.4l-7.9 6.2C6.4 42.6 14.6 48 24 48z"/></svg>
        {{ loading() ? 'Abriendo Google…' : 'Continuar con Google' }}
      </button>
      @if (error()) { <p class="login__error" role="alert">{{ error() }}</p> }
      <small>Ingresa con la cuenta autorizada del restaurante.</small>
      <a href="https://restaurantecostamar.cl/">Volver a la web de Costa Mar →</a>
    </section></main>
  `,
  styles: [`
    .login-page { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; background: radial-gradient(ellipse at 10% 0%, #1b5a72, transparent 65%), #0e2a38; padding: 1.5rem; }
    .login { width: 100%; max-width: 440px; background: #fff; border-radius: 26px; padding: 2.25rem; text-align: center; box-shadow: 0 24px 70px #0003; }
    img { object-fit: contain; border-radius: 50%; padding: 8px; border: 1px solid #e6eff3; } .eyebrow { display: block; color: #925600; margin: 1rem 0 .6rem; }
    h1 { font-size: clamp(1.6rem, 5vw, 2rem); margin: .5rem 0 1rem; } p { color: var(--cm-muted); font-size: .93rem; }
    .google { margin: 1rem 0; padding: .85rem 1rem; min-height: 50px; width: 100%; display: flex; gap: .7rem; align-items: center; justify-content: center; border: 1px solid #c9dce3; border-radius: 12px; background: #fff; font-weight: 700; color: var(--cm-text); box-shadow: 0 4px 12px #17324d08; }
    small { display: block; font-size: .78rem; color: var(--cm-muted); } a { display: inline-block; margin-top: 1.5rem; font-size: .8rem; text-decoration: none; } .login__error { color: #a83227; }
    @media (max-width: 380px) { .login { padding: 1.5rem; } }
  `],
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  constructor() {
    effect(() => {
      if (this.auth.ready() && this.auth.isAuthenticated()) void this.router.navigate([this.auth.user()?.role === 'cashier' ? '/club/validar' : '/dashboard']);
    });
  }
  async loginGoogle(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true); this.error.set(null);
    try { await this.auth.loginWithGoogle(); }
    catch { this.error.set('No pudimos abrir Google. Revisa tu conexión e inténtalo de nuevo.'); this.loading.set(false); }
  }
}
