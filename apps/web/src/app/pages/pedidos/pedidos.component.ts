import { Component, OnInit, inject } from '@angular/core';
import { ComingSoonComponent } from '../../shared/coming-soon.component';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'cm-pedidos',
  standalone: true,
  imports: [ComingSoonComponent],
  template: `
    <cm-coming-soon
      title="Pedidos Online"
      message="Los pedidos para retiro y delivery estarán disponibles pronto"
    />
  `,
})
export class PedidosComponent implements OnInit {
  private readonly seo = inject(SeoService);
  ngOnInit(): void {
    this.seo.update({
      title: 'Pedidos — Costa Mar Barra Cevichera',
      description:
        'Pide en línea en Costa Mar Barra Cevichera, Quillota. Función en preparación.',
      path: '/pedidos',
    });
  }
}
