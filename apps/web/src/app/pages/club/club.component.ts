import { Component, OnInit, inject } from '@angular/core';
import { BUSINESS } from '@costamar/shared';
import { SeoService } from '../../core/seo.service';

@Component({
  selector: 'cm-club',
  standalone: true,
  imports: [],
  template: `
    <section class="cm-section club-intro">
      <span class="cm-eyebrow">Un lugar en nuestra mesa</span>
      <h1>Costa Mar Club</h1>
      <p>Regístrate gratis y consulta los beneficios y campañas disponibles para ti.</p>
      <p>Los regalos y beneficios de cumpleaños están sujetos a elegibilidad,
        vigencia y disponibilidad. Revisa las condiciones desde tu cuenta.</p>
      <a [href]="business.clubUrl" class="cm-button cm-button--primary">Conoce Costa Mar Club ↗</a>
    </section>
  `,
  styles: ['.club-intro{max-width:760px;min-height:440px}.club-intro h1{font-size:clamp(2.5rem,6vw,4rem);color:var(--cm-deep)}.club-intro p{color:var(--cm-muted);max-width:560px}.club-intro .cm-button{margin-top:1rem}'],
})
export class ClubComponent implements OnInit {
  protected readonly business = BUSINESS;
  private readonly seo = inject(SeoService);
  ngOnInit(): void {
    this.seo.update({
      title: 'Club Costa Mar — Fidelización',
      description:
        'Conoce Costa Mar Club: registro gratuito y beneficios sujetos a elegibilidad, vigencia y disponibilidad.',
      path: '/club',
    });
  }
}
