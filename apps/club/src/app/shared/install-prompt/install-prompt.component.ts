import { Component, computed, inject, signal } from '@angular/core';
import { PwaInstallService } from '../../core/pwa-install.service';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

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
  private readonly router=inject(Router);
  private readonly path=toSignal(this.router.events.pipe(filter((e):e is NavigationEnd=>e instanceof NavigationEnd),map(e=>e.urlAfterRedirects)),{initialValue:this.router.url});

  private readonly dismissed = signal(this.pwa.wasDismissed());
  protected readonly showIosHelp = signal(false);

  /** Muestra el banner si procede y no fue descartado ni ya instalado. */
  protected readonly visible = computed(() => {
    if(this.path().split('?')[0]==='/personalizar')return false;
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
