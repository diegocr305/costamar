import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cm-beneficios',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <a routerLink="/" class="back">← Volver</a>
      <h1>Beneficios del Club</h1>
      <p class="lead">
        Estamos preparando beneficios exclusivos para los socios de Costa Mar.
        Pronto encontrarás aquí tus promociones.
      </p>
      <ul class="list">
        <li>Promociones exclusivas para socios.</li>
        <li>Tarjeta digital siempre contigo.</li>
        <li>Novedades y lanzamientos antes que nadie.</li>
      </ul>
      <p class="note">
        El detalle de puntos y canjes se habilitará más adelante.
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
        margin: 1rem 0 0.5rem;
        font-size: 1.8rem;
      }
      .lead {
        color: var(--cm-muted);
      }
      .list {
        padding-left: 1.1rem;
        line-height: 2;
      }
      .note {
        color: var(--cm-muted);
        font-size: 0.85rem;
        margin-top: 1.5rem;
      }
    `,
  ],
})
export class BeneficiosComponent {}
