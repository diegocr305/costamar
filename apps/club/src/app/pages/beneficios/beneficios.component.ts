import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'cm-beneficios', standalone: true, imports: [RouterLink],
  template: `
    <section class="page">
      <a [routerLink]="auth.isAuthenticated() ? '/inicio' : '/'" class="back">← Volver</a>
      <span class="eyebrow">Club Costa Mar</span>
      <h1>Más motivos para volver</h1>
      <p class="lead">Ser socio es gratis. Completa tu perfil y tus regalos aparecerán en Mis cupones cuando cumplas sus condiciones.</p>
      <article class="benefit">
        <span class="icon" aria-hidden="true">🎁</span><h2>Tu regalo de bienvenida</h2>
        <p><strong>1 bebestible personal de regalo</strong> a elección entre jugo, bebida o schop de cerveza, con consumo asociado en el restaurante.</p>
        <p class="note">Para los primeros 50 socios fundadores elegibles. Un regalo por socio, sujeto a cupos y disponibilidad. El beneficio es personal.</p>
      </article>
      <article class="benefit benefit--birthday">
        <span class="icon" aria-hidden="true">🎂</span><h2>Barco Cumpleañero</h2>
        <p>Celebramos contigo con <strong>1 bebestible y 1 postre personal</strong>, con consumo asociado en el local.</p>
        <p class="note">Disponible durante todo tu mes de cumpleaños, aunque tu cumpleaños ya haya pasado. Un cupón por socio por año. Vence al terminar el mes. Si te unes durante tu mes, también puedes recibirlo.</p>
      </article>
      <article class="how"><h2>¿Cómo uso mi regalo?</h2><ol><li>Entra al Club y completa tu perfil.</li><li>Revisa tus regalos disponibles en Mis cupones.</li><li>Visítanos y muestra el QR de Mi tarjeta al personal.</li></ol><p class="note">El personal confirma el beneficio y registra su uso. No tienes que activar ni reclamar el cupón.</p></article>
      <p class="note">Club para mayores de 18 años con perfil completo y membresía activa. Beneficios personales, sujetos a disponibilidad, no acumulables ni canjeables por dinero. La opción con alcohol requiere validar tu edad presencialmente.</p>
      <a [routerLink]="auth.isAuthenticated() ? '/cupones' : '/'" class="cm-btn cm-btn--gold">{{ auth.isAuthenticated() ? 'Ver mis cupones' : 'Quiero ser parte del Club' }}</a>
    </section>
  `,
  styles: [`
    .page { flex: 1; padding: 2rem 1.5rem; } .back { color: var(--cm-muted); text-decoration: none; font-size: .9rem; }
    .eyebrow { display: block; margin-top: 1.5rem; color: #ffbf58; font-size: .7rem; letter-spacing: .15em; text-transform: uppercase; }
    h1 { margin: .4rem 0 .75rem; font-size: 1.9rem; } .lead, .note { color: var(--cm-muted); } .note { font-size: .85rem; }
    .benefit { background: var(--cm-surface); border: 1px solid var(--cm-border); border-radius: 16px; padding: 1.25rem; margin: 1rem 0; }
    .benefit--birthday { border-color: #80dceb70; } .icon { font-size: 1.8rem; } h2 { font-size: 1.2rem; margin: .5rem 0; }
    .how { margin: 1.5rem 0; } ol { padding-left: 1.3rem; } li { margin: .5rem 0; } .cm-btn { width: 100%; }
  `],
})
export class BeneficiosComponent { protected readonly auth = inject(AuthService); }
