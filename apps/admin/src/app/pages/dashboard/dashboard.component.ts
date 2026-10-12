import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { sectionsForRole } from '../../core/navigation';
import { ClubStaffService } from '../../features/club/club-staff.service';

@Component({
  selector: 'cm-dashboard', standalone: true, imports: [RouterLink],
  template: `
    <section class="dashboard"><header class="page-head"><div><span class="eyebrow">Costa Mar · Nuestro equipo</span><h1>Todo listo para atender</h1><p>Tus herramientas para recibir a los socios y llevar el registro de sus regalos.</p></div></header>
    @if (canValidate()) {
      <div class="today"><span class="today__icon" aria-hidden="true">✓</span><div><strong>{{ todayCount() === null ? 'Canjes de hoy' : todayCount() + ' canjes hoy' }}</strong><p>{{ countError() ? 'No pudimos actualizar el resumen. Consulta el historial.' : 'Registro de atención en horario de Chile.' }}</p></div><a routerLink="/club/historial">Ver historial →</a></div>
    }
    <h2>¿Qué necesitas hacer?</h2><div class="cards">@for (section of tools(); track section.path) { <a [routerLink]="section.path" class="tool"><span class="tool__icon" aria-hidden="true">{{ section.path === '/club/validar' ? '📷' : section.path === '/club/historial' ? '🧾' : section.path === '/club/campanas' ? '🎁' : '🍽️' }}</span><strong>{{ section.label }}</strong><p>{{ section.path === '/club/validar' ? 'Abre la cámara, revisa el beneficio y confirma el canje.' : section.path === '/club/historial' ? 'Busca un socio, código o mesa y consulta quién lo atendió.' : section.path === '/club/campanas' ? 'Define regalos, productos, cupos y vigencia de tus promociones.' : 'Actualiza productos, precios y disponibilidad.' }}</p><span class="tool__action">Abrir →</span></a> }</div>
    @if (tools().length === 0) { <p>Tu cuenta no tiene herramientas habilitadas aquí. Contacta al encargado del restaurante.</p> }
    <p class="note">Reservas, pedidos e inventario están en preparación. Los registros del Club ya están disponibles.</p></section>
  `,
  styles: [`
    .dashboard { max-width: 1120px; margin: 0 auto; } h2 { font-size: 1.2rem; margin: 1.75rem 0 1rem; }
    .today { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 1.25rem; border: 1px solid #c7e5df; background: #eef9f5; border-radius: 16px; } .today__icon { width: 44px; height: 44px; border-radius: 12px; background: #d6efe4; color: #1b7157; display: grid; place-items: center; font-size: 1.5rem; } .today p { font-size: .82rem; margin: .2rem 0 0; color: var(--cm-muted); } .today a { margin-left: auto; font-size: .85rem; font-weight: 700; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1rem; } .tool { display: grid; gap: .75rem; text-decoration: none; background: #fff; border: 1px solid var(--cm-border); border-radius: 18px; padding: 1.5rem; color: var(--cm-text); box-shadow: 0 6px 20px #17324d06; } .tool:hover { border-color: #087c91; } .tool__icon { font-size: 1.8rem; } .tool strong { font-size: 1.15rem; } .tool p { font-size: .88rem; color: var(--cm-muted); margin: 0; } .tool__action { color: var(--cm-primary-dark); font-size: .85rem; font-weight: 700; } .note { margin: 1.5rem 0; color: var(--cm-muted); font-size: .8rem; }
  `],
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly staff = inject(ClubStaffService);
  protected readonly todayCount = signal<number | null>(null);
  protected readonly countError = signal(false);
  protected readonly tools = computed(() => sectionsForRole(this.auth.user()?.role ?? 'customer').filter(s => ['/club/validar', '/club/historial', '/club/campanas', '/carta'].includes(s.path)));
  protected readonly canValidate = computed(() => this.tools().some(s => s.path === '/club/validar'));
  ngOnInit(): void {
    if (!this.canValidate()) return;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)?.value).join('-');
    this.staff.history(today, '').subscribe({ next: result => this.todayCount.set(result.total), error: () => this.countError.set(true) });
  }
}
