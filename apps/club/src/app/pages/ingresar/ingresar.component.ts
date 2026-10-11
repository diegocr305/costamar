import { Component, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

type State = 'ready' | 'authenticating' | 'error';

@Component({
  selector: 'cm-ingresar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './ingresar.component.html',
  styleUrl: './ingresar.component.css',
})
export class IngresarComponent {
  private readonly auth = inject(AuthService);

  protected readonly state = signal<State>('ready');

  async login(): Promise<void> {
    this.state.set('authenticating');
    try {
      // Redirige a Google; al volver, /auth/callback completa el flujo.
      await this.auth.loginWithGoogle();
    } catch {
      this.state.set('error');
    }
  }
}
