import {
  Component,
  ChangeDetectorRef,
  ElementRef,
  OnDestroy,
  OnInit,
  HostListener,
  signal,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import jsQR from 'jsqr';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type { CampaignProductRole } from '@costamar/shared';
import { firstValueFrom } from 'rxjs';
import {
  ClubStaffService,
  type StaffLookup,
  type RedemptionConfirmation,
  type RedemptionHistory,
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
export class ClubValidarComponent implements OnInit, OnDestroy {
  private readonly staff = inject(ClubStaffService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected readonly step = signal<Step>('scan');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected memberCodeInput = signal('');
  protected readonly lookup = signal<StaffLookup | null>(null);
  protected selectedCoupon = signal<string | null>(null);
  protected tableLabel = signal('');
  protected orderRef = signal('');
  protected note = signal('');
  protected readonly confirmation = signal<RedemptionConfirmation | null>(null);
  protected readonly recent = signal<RedemptionHistory>({ items: [], total: 0, page: 1, pageSize: 6 });
  protected readonly recentLoading = signal(false);
  protected readonly recentError = signal(false);
  protected recentTable = '';
  private recentRequest = 0;

  ngOnInit(): void { void this.loadRecent(); }
  @HostListener('document:visibilitychange')
  protected onVisibility(): void { if (document.visibilityState === 'visible') void this.loadRecent(); }
  protected async loadRecent(): Promise<void> {
    const request = ++this.recentRequest;
    this.recentLoading.set(true); this.recentError.set(false);
    try { const result = await firstValueFrom(this.staff.recent(this.recentTable)); if (request === this.recentRequest) this.recent.set(result); }
    catch { if (request === this.recentRequest) this.recentError.set(true); }
    finally { if (request === this.recentRequest) this.recentLoading.set(false); }
  }
  protected clearRecent(): void { this.recentTable = ''; void this.loadRecent(); }
  protected time(iso: string): string { return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  protected readonly selectedProducts = signal<Record<string, string>>({});
  protected readonly productRoles = computed(() => [...new Set(this.lookup()?.coupons.find(c => c.code === this.selectedCoupon())?.allowedProducts?.map(p => p.role) ?? [])]);
  protected readonly productsReady = computed(() => this.productRoles().every(role => !!this.selectedProducts()[role]));

  protected options(role: CampaignProductRole) { return this.lookup()?.coupons.find(c => c.code === this.selectedCoupon())?.allowedProducts?.filter(p => p.role === role) ?? []; }
  protected roleLabel(role: CampaignProductRole): string { return { drink: 'Bebestible', dessert: 'Postre', gift: 'Regalo' }[role]; }
  protected setProduct(role: CampaignProductRole, id: string): void { this.selectedProducts.update(p => ({ ...p, [role]: id })); }

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
    this.recentRequest++;
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
      if (res.member.status === 'active' && available.length === 1) this.pickCoupon(available[0].code);
      else { this.selectedCoupon.set(null); this.selectedProducts.set({}); }
      this.step.set('review');
    } catch (e: unknown) {
      this.error.set(this.msg(e, 'Socio no encontrado.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected pickCoupon(code: string): void {
    this.selectedCoupon.set(code);
    const products: Record<string, string> = {};
    for (const role of this.productRoles()) {
      const choices = this.options(role).filter(p => p.isAvailable);
      if (choices.length === 1) products[role] = choices[0].productId;
    }
    this.selectedProducts.set(products);
  }

  /** Confirma el canje del cupón seleccionado. */
  async confirmRedeem(): Promise<void> {
    const code = this.selectedCoupon();
    if (!code || this.loading()) return;
    if (!this.tableLabel().trim()) {
      this.error.set('Indica la mesa para registrar el canje.');
      return;
    }
    if (!this.productsReady()) { this.error.set('Selecciona los productos que entregarás al socio.'); return; }
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.staff.redeem(code, this.tableLabel().trim(), this.productRoles().map(role => ({ productId: this.selectedProducts()[role], role })), this.orderRef(), this.note()),
      );
      this.confirmation.set(result.redemption);
      this.step.set('done');
      void this.loadRecent();
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
    this.selectedProducts.set({});
    this.tableLabel.set('');
    this.orderRef.set('');
    this.note.set('');
    this.confirmation.set(null);
    this.error.set(null);
  }

  private msg(e: unknown, fallback: string): string {
    const err = e as { error?: { message?: string } };
    return err?.error?.message ?? fallback;
  }
}
