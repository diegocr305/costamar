import { Component, OnInit, inject } from '@angular/core';
import { ComingSoonComponent } from '../../shared/coming-soon.component';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'cm-reservas',
  standalone: true,
  imports: [ComingSoonComponent],
  template: `
    <cm-coming-soon
      title="Reservas"
      message="Las reservas en línea estarán disponibles muy pronto"
    />
  `,
})
export class ReservasComponent implements OnInit {
  private readonly seo = inject(SeoService);
  ngOnInit(): void {
    this.seo.update({
      title: 'Reservas — Costa Mar Barra Cevichera',
      description:
        'Reserva tu mesa en Costa Mar Barra Cevichera, Quillota. Función en preparación.',
      path: '/reservas',
    });
  }
}
