import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter } from 'rxjs';

/**
 * Navegación inferior de 4 secciones. Solo visible en rutas autenticadas
 * (inicio, cupones, mi-tarjeta, perfil). Oculta en landing/ingresar/callback.
 */
@Component({
  selector: 'cm-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgClass],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.css',
})
export class BottomNavComponent {
  private readonly router = inject(Router);

  private readonly hiddenRoutes = ['/', '/ingresar', '/auth/callback', '/completar-perfil'];
  protected readonly visible = signal(this.computeVisible(this.router.url));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.visible.set(this.computeVisible(e.urlAfterRedirects)));
  }

  private computeVisible(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return !this.hiddenRoutes.includes(path);
  }
}
