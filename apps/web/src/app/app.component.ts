import { ActionIconComponent } from './shared/action-icon.component';
import { Component, HostListener, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { BUSINESS } from '@costamar/shared';

@Component({
  selector: 'cm-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ActionIconComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly document = inject(DOCUMENT);
  protected readonly business = BUSINESS;
  protected readonly year = new Date().getFullYear();

  /** Estado del menú móvil (hamburguesa). SSR-safe: solo signal. */
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /** Cierra el menú al pulsar Escape (accesibilidad). */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.menuOpen()) {
      this.closeMenu();
      this.document.querySelector<HTMLButtonElement>('.cm-burger')?.focus();
    }
  }
}
