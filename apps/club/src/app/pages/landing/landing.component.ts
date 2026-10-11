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
    // Espera breve a la restauración de sesión; si ya hay sesión, a la tarjeta.
    if (this.auth.ready() && this.auth.isAuthenticated()) {
      await this.router.navigate(['/mi-tarjeta']);
    }
  }

  goToLogin(): void {
    void this.router.navigate(['/ingresar']);
  }
}
