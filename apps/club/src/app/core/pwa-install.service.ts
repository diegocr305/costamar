import { Injectable, signal } from '@angular/core';

/** Evento beforeinstallprompt (no está en los tipos estándar de TS). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cm_pwa_install_dismissed';

/**
 * Gestiona la invitación de instalación de la PWA.
 * - Android/Chrome: captura `beforeinstallprompt` y permite instalar.
 * - iOS: no soporta ese evento; se muestran instrucciones manuales.
 * No bloquea nada: la invitación es descartable y recordada.
 */
@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  /** Se puede instalar vía prompt nativo (Android/Chrome). */
  readonly canInstall = signal(false);
  /** Dispositivo iOS (Safari) sin soporte de prompt nativo. */
  readonly isIos = signal(false);
  /** Ya está instalada (modo standalone). */
  readonly isStandalone = signal(false);

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    this.isStandalone.set(this.detectStandalone());
    this.isIos.set(this.detectIos());

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.canInstall.set(false);
      this.deferredPrompt = null;
      this.isStandalone.set(true);
    });
  }

  /** True si el usuario descartó la invitación antes. */
  wasDismissed(): boolean {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  }

  dismiss(): void {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    this.canInstall.set(false);
  }

  /** Dispara el prompt nativo de instalación (Android/Chrome). */
  async promptInstall(): Promise<void> {
    if (!this.deferredPrompt) return;
    await this.deferredPrompt.prompt();
    await this.deferredPrompt.userChoice;
    this.deferredPrompt = null;
    this.canInstall.set(false);
  }

  private detectStandalone(): boolean {
    const mql = window.matchMedia?.('(display-mode: standalone)').matches;
    // iOS expone navigator.standalone
    const iosStandalone = (window.navigator as { standalone?: boolean })
      .standalone;
    return Boolean(mql || iosStandalone);
  }

  private detectIos(): boolean {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }
}
