import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BUSINESS } from '@costamar/shared';

@Component({
  selector: 'cm-ayuda',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <a routerLink="/" class="back">← Volver</a>
      <h1>Ayuda</h1>

      <h2>¿Cómo ingreso?</h2>
      <p>
        El Club usa tu cuenta de Google. No necesitas crear una contraseña ni
        instalar ninguna aplicación.
      </p>

      <h2>No puedo iniciar sesión</h2>
      <p>
        Intenta nuevamente desde "Continuar con Google". Si el problema
        persiste, escríbenos y te ayudamos a recuperar el acceso.
      </p>

      <h2>Contacto</h2>
      <p>
        <a [href]="'mailto:' + business.email">{{ business.email }}</a><br />
        <a [href]="business.whatsapp" target="_blank" rel="noopener">WhatsApp</a>
      </p>
    </section>
  `,
  styles: [
    `
      .page {
        flex: 1;
        padding: 2.5rem 1.5rem;
      }
      .back {
        color: var(--cm-muted);
        text-decoration: none;
        font-size: 0.9rem;
      }
      h1 {
        margin: 1rem 0 1rem;
        font-size: 1.8rem;
      }
      h2 {
        font-size: 1.1rem;
        margin: 1.5rem 0 0.3rem;
      }
      p {
        color: var(--cm-muted);
        margin: 0;
      }
    `,
  ],
})
export class AyudaComponent {
  protected readonly business = BUSINESS;
}
