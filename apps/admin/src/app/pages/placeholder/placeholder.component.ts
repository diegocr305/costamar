import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'cm-placeholder',
  standalone: true,
  template: `
    <h1>{{ title }}</h1>
    <p class="hint">Esta sección estará disponible próximamente.</p>
  `,
  styles: [
    `
      h1 {
        color: var(--cm-ocean, #1263a0);
        margin: 0;
      }
      .hint {
        color: #5a7382;
      }
    `,
  ],
})
export class PlaceholderComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title =
    (this.route.snapshot.data['title'] as string) ?? 'Sección';
}
