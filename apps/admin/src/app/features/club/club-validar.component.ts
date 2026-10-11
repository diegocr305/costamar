import {
  Component,
  ElementRef,
  OnDestroy,
  signal,
  inject,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [FormsModule],
  templateUrl: './club-validar.component.html',
  styleUrl: './club-validar.component.css',
})
export class ClubValidarComponent implements OnDestroy {
  private readonly staff = inject(ClubStaffService);

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
    typeof window !== 'undefined' && 'BarcodeDetector' in window,
  );
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
  private stream: MediaStream | null = null;
  private rafId: number | null = null;

  ngOnDestroy(): void {
    this.stopScan();
  }

  /** Abre la cámara trasera y detecta QR. */
  async startScan(): Promise<void> {
    this.error.set(null);
    if (!this.scanSupported()) {
      this.error.set('Tu navegador no soporta escaneo. Usa el código manual.');
      return;
    }
    try {
      this.scanning.set(true);
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      const video = this.videoRef()?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      await video.play();
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const tick = async () => {
        if (!this.scanning()) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0) {
            const value = codes[0].rawValue?.trim();
            if (value) {
              this.memberCodeInput.set(value);
              this.stopScan();
              void this.search();
              return;
            }
          }
        } catch {
          /* ignora frames sin lectura */
        }
        this.rafId = requestAnimationFrame(() => void tick());
      };
      this.rafId = requestAnimationFrame(() => void tick());
    } catch {
      this.scanning.set(false);
      this.error.set('No se pudo abrir la cámara. Revisa permisos o usa el código manual.');
    }
  }

  /** Detiene la cámara y libera recursos. */
  stopScan(): void {
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
    const code = this.memberCodeInput().trim();
    if (!code) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await firstValueFrom(this.staff.lookup(code));
      this.lookup.set(res);
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
    if (!code) return;
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
