import { Component, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { sectionsForRole } from '../core/navigation';

/**
 * Shell del panel: barra lateral con las secciones permitidas al rol del
 * usuario y cabecera con cierre de sesión.
 */
@Component({
  selector: 'cm-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly sections = computed(() => {
    const u = this.user();
    return u ? sectionsForRole(u.role) : [];
  });

  protected roleLabel(role?: string): string {
    return ({ superadmin: 'Superadministrador', admin: 'Administrador', manager: 'Encargado', cashier: 'Caja y atención', kitchen: 'Cocina', inventory: 'Inventario', customer: 'Socio' } as Record<string, string>)[role ?? ''] ?? '';
  }

  protected icon(path: string): string {
    return ({ '/reservas': '▦', '/club/socios': '♧', '/dashboard': '⌂', '/club/validar': '▦', '/club/historial': '↺', '/club/campanas': '☆', '/carta': '☷', '/pedidos': '▤', '/inventario': '▣', '/usuarios': '♙' } as Record<string, string>)[path] ?? '';
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
