import { Component } from '@angular/core';

@Component({
  selector: 'cm-home',
  standalone: true,
  template: `
    <div class="club">
      <h1>Club Costa Mar</h1>
      <p class="points">0 puntos</p>
      <p class="level">Nivel: Bronce</p>
    </div>
  `,
  styles: [
    `
      .club {
        padding: 2rem;
        text-align: center;
      }
      h1 {
        color: var(--cm-primary);
      }
      .points {
        font-size: 2rem;
        font-weight: 700;
        color: var(--cm-accent);
      }
    `,
  ],
})
export class HomeComponent {}
