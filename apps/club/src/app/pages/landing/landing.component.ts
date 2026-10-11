import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/**
 * Landing pública del Club: beneficios + "Continuar con Google".
 * Si el usuario ya tiene sesión, lo lleva directo a su tarjeta.
 */
@Component({
  selector: 'cm-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css',
})
export class LandingComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    // Salvaguarda: si Supabase devolvió el código OAuth a la raíz del club
    // (p. ej. porque la Redirect URL apunta a "/"), reenviar al callback
    // conservando el query, para completar el intercambio PKCE.
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('code')) {
        const queryParams: Record<string, string> = {};
        params.forEach((value, key) => {
          queryParams[key] = value;
        });
        await this.router.navigate(['/auth/callback'], { queryParams });
        return;
      }
    }

    // Si ya hay sesión, a la tarjeta.
    if (this.auth.ready() && this.auth.isAuthenticated()) {
      await this.router.navigate(['/mi-tarjeta']);
    }
  }

  goToLogin(): void {
    void this.router.navigate(['/ingresar']);
  }
}
