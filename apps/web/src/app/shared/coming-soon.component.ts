import { Component, Input } from '@angular/core';
import { BUSINESS } from '@costamar/shared';

@Component({
  selector: 'cm-coming-soon',
  standalone: true,
  template: `
    <section class="soon">
      <h1>{{ title }}</h1>
      <p class="soon__status">{{ message }}</p>
      <p>
        Mientras tanto, puedes escribirnos directamente por WhatsApp y con gusto
        te ayudamos.
      </p>
      <a
        [href]="business.whatsapp"
        target="_blank"
        rel="noopener"
        class="soon__wa"
        >Escríbenos por WhatsApp</a
      >
    </section>
  `,
  styles: [
    `
      .soon {
        max-width: 640px;
        margin: 0 auto;
        padding: 5rem 1.5rem;
        text-align: center;
      }
      .soon__status {
        display: inline-block;
        background: var(--cm-secondary);
        color: var(--cm-text);
        padding: 0.4rem 1rem;
        border-radius: 999px;
        font-weight: 600;
        margin-bottom: 1rem;
      }
      .soon__wa {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background: var(--cm-action);
        color: var(--cm-deep);
        border-radius: var(--cm-radius);
        text-decoration: none;
        font-weight: 600;
      }
    `,
  ],
})
export class ComingSoonComponent {
  @Input({ required: true }) title!: string;
  @Input() message = 'Función en preparación';
  protected readonly business = BUSINESS;
}
