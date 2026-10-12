import {
  Component,
  ChangeDetectorRef,
  ElementRef,
  OnDestroy,
  signal,
  inject,
  viewChild,
} from '@angular/core';
import jsQR from 'jsqr';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  ClubStaffService,
  type StaffLookup,
} from './club-staff.service';

type Step = 'scan' | 'review' | 'done';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
};

@Component({
  selector: 'cm-club-validar',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './club-validar.component.html',
  styleUrl: './club-validar.component.css',
})
export class ClubValidarComponent implements OnDestroy {
  private readonly staff = inject(ClubStaffService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected readonly step = signal<Step>('scan');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected memberCodeInput = signal('');
  protected readonly lookup = signal<StaffLookup | null>(null);
  protected selectedCoupon = signal<string | null>(null);
  protected consumptionRef = signal('');

  // --- Escáner de cámara ---
  protected readonly scanning = signal(false);
  protected readonly scanSupported = signal(
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );
  private scanSession = 0;
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private rafId: number | null = null;

  ngOnDestroy(): void {
    this.stopScan();
  }

  /** Abre la cámara trasera y detecta QR. */
  async startScan(): Promise<void> {
    if (this.scanning() || this.loading()) return;
    this.error.set(null);
    if (!this.scanSupported()) {
      this.error.set('La cámara no está disponible. Abre el admin en localhost o mediante HTTPS.');
      return;
    }
    const session = ++this.scanSession;
    try {
      this.scanning.set(true);
      this.changeDetector.detectChanges();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      if (session !== this.scanSession) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      const video = this.videoRef()?.nativeElement;
      if (!video) throw new Error('Cámara no disponible');
      video.srcObject = this.stream;
      await video.play();
      if (session !== this.scanSession) return;
      // Decodificador compatible también cuando BarcodeDetector no existe.
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Lector QR no disponible');
      let detector: BarcodeDetectorLike | null = null;
      try {
        if ('BarcodeDetector' in window) detector = new BarcodeDetector({ formats: ['qr_code'] });
      } catch { /* usa jsQR */ }
      const tick = async () => {
        if (session !== this.scanSession || !this.scanning()) return;
        try {
          let value: string | undefined;
          if (video.readyState >= 2 && video.videoWidth > 0) {
            if (detector) {
              try { value = (await detector.detect(video))[0]?.rawValue; }
              catch { detector = null; }
            }
            if (!detector) {
              canvas.width = Math.min(video.videoWidth, 640);
              canvas.height = Math.round(video.videoHeight * canvas.width / video.videoWidth);
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              value = jsQR(frame.data, frame.width, frame.height)?.data;
            }
            if (session !== this.scanSession) return;
            value = value?.trim().toUpperCase();
            if (value && /^CM-[A-Z0-9]{6}$/.test(value)) {
              this.memberCodeInput.set(value);
              this.stopScan();
              void this.search();
              return;
            }
          }
        } catch {
          /* ignora frames sin lectura */
        }
        if (session === this.scanSession) this.rafId = requestAnimationFrame(() => void tick());
      };
      this.rafId = requestAnimationFrame(() => void tick());
    } catch (error) {
      if (session !== this.scanSession) return;
      this.stopScan();
      this.error.set(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Permite el acceso a la cámara para escanear el QR del cliente.'
        : 'No se pudo abrir la cámara. Revisa que esté conectada y disponible.');
    }
  }

  /** Detiene la cámara y libera recursos. */
  stopScan(): void {
    this.scanSession++;
    this.scanning.set(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  /** Busca el socio por member_code (ingresado manual o leído del QR). */
  async search(): Promise<void> {
    if (this.loading()) return;
    this.stopScan();
    const code = this.memberCodeInput().trim();
    if (!code) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.staff.lookup(code));
      this.lookup.set(res);
      const available = res.coupons.filter(c => c.status === 'issued' && (!c.expiresAt || new Date(c.expiresAt).getTime() > Date.now()));
      this.selectedCoupon.set(res.member.status === 'active' && available.length === 1 ? available[0].code : null);
      this.step.set('review');
    } catch (e: unknown) {
      this.error.set(this.msg(e, 'Socio no encontrado.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected pickCoupon(code: string): void {
    this.selectedCoupon.set(code);
  }

  /** Confirma el canje del cupón seleccionado. */
  async confirmRedeem(): Promise<void> {
    const code = this.selectedCoupon();
    if (!code || this.loading()) return;
    if (!this.consumptionRef().trim()) {
      this.error.set('Indica la mesa, pedido o boleta para poder consultar este canje después.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.staff.redeem(code, this.consumptionRef().trim() || undefined),
      );
      this.step.set('done');
    } catch (e: unknown) {
      this.error.set(this.msg(e, 'No se pudo canjear el cupón.'));
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.stopScan();
    this.step.set('scan');
    this.memberCodeInput.set('');
    this.lookup.set(null);
    this.selectedCoupon.set(null);
    this.consumptionRef.set('');
    this.error.set(null);
  }

  private msg(e: unknown, fallback: string): string {
    const err = e as { error?: { message?: string } };
    return err?.error?.message ?? fallback;
  }
}
