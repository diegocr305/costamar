import { Component, OnInit, inject } from '@angular/core';
import { ComingSoonComponent } from '../../shared/coming-soon.component';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'cm-club',
  standalone: true,
  imports: [ComingSoonComponent],
  template: `
    <cm-coming-soon
      title="Club Costa Mar"
      message="Nuestro programa de fidelización estará disponible pronto"
    />
  `,
})
export class ClubComponent implements OnInit {
  private readonly seo = inject(SeoService);
  ngOnInit(): void {
    this.seo.update({
      title: 'Club Costa Mar — Fidelización',
      description:
        'Acumula puntos y accede a beneficios en Costa Mar Barra Cevichera. Función en preparación.',
      path: '/club',
    });
  }
}
