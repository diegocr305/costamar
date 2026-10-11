import { Component, computed, inject, signal } from '@angular/core';
import { PwaInstallService } from '../../core/pwa-install.service';

/**
 * Banner discreto para invitar a instalar la PWA. No bloquea el registro.
 * - Android/Chrome: botón "Instalar" (prompt nativo).
 * - iOS: instrucciones (Compartir → Agregar a inicio).
 * Se puede cerrar y se recuerda la decisión.
 */
@Component({
  selector: 'cm-install-prompt',
  standalone: true,
  templateUrl: './install-prompt.component.html',
  styleUrl: './install-prompt.component.css',
})
export class InstallPromptComponent {
  private readonly pwa = inject(PwaInstallService);

  private readonly dismissed = signal(this.pwa.wasDismissed());
  protected readonly showIosHelp = signal(false);

  /** Muestra el banner si procede y no fue descartado ni ya instalado. */
  protected readonly visible = computed(() => {
    if (this.pwa.isStandalone() || this.dismissed()) return false;
    return this.pwa.canInstall() || this.pwa.isIos();
  });

  protected readonly isIos = this.pwa.isIos;
  protected readonly canInstall = this.pwa.canInstall;

  async install(): Promise<void> {
    if (this.pwa.isIos()) {
      this.showIosHelp.set(true);
      return;
    }
    await this.pwa.promptInstall();
  }

  close(): void {
    this.pwa.dismiss();
    this.dismissed.set(true);
  }
}
