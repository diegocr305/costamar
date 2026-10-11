import { Component } from '@angular/core';

interface MetricCard {
  label: string;
  hint: string;
}

@Component({
  selector: 'cm-dashboard',
  standalone: true,
  template: `
    <h1>Dashboard</h1>
    <p class="subtitle">Resumen del día</p>
    <div class="cards">
      @for (c of cards; track c.label) {
        <div class="card">
          <span class="card__label">{{ c.label }}</span>
          <span class="card__value">—</span>
          <span class="card__hint">{{ c.hint }}</span>
        </div>
      }
    </div>
  `,
  styles: [
    `
      h1 {
        margin: 0;
        color: var(--cm-ocean, #1263a0);
      }
      .subtitle {
        color: #5a7382;
        margin-top: 0.25rem;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-top: 1.5rem;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        padding: 1.25rem 1.5rem;
        background: #fff;
        border-radius: 10px;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
      }
      .card__label {
        font-size: 0.85rem;
        color: #5a7382;
      }
      .card__value {
        font-size: 1.8rem;
        font-weight: 700;
        color: var(--cm-primary, #0a5c7a);
      }
      .card__hint {
        font-size: 0.75rem;
        color: #90a4ae;
      }
    `,
  ],
})
export class DashboardComponent {
  protected readonly cards: MetricCard[] = [
    { label: 'Reservas del día', hint: 'Pendiente de conectar' },
    { label: 'Pedidos activos', hint: 'Pendiente de conectar' },
    { label: 'Alertas de stock', hint: 'Pendiente de conectar' },
    { label: 'Ventas del día', hint: 'Pendiente de conectar' },
  ];
}
