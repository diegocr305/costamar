import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { AuthService } from '../../core/auth.service';
import { MembershipStore } from '../../core/membership.store';

@Component({
  selector: 'cm-mi-tarjeta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mi-tarjeta.component.html',
  styleUrl: './mi-tarjeta.component.css',
})
export class MiTarjetaComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly store = inject(MembershipStore);

  /** Data URL del QR del código de socio (identificador público). */
  protected readonly qrDataUrl = signal<string | null>(null);

  constructor() {
    // Genera el QR cuando hay un socio activo. El QR solo contiene el
    // member_code (público): no incluye datos personales ni credenciales.
    effect(() => {
      const member = this.store.member();
      if (member?.memberCode) {
        void this.generateQr(member.memberCode);
      } else {
        this.qrDataUrl.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  private async generateQr(code: string): Promise<void> {
    try {
      const url = await QRCode.toDataURL(code, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 240,
        color: { dark: '#1263a0', light: '#ffffff' },
      });
      this.qrDataUrl.set(url);
    } catch {
      this.qrDataUrl.set(null);
    }
  }

  protected retry(): void {
    this.store.load();
  }

  protected levelLabel(level: string): string {
    const map: Record<string, string> = {
      bronce: 'Bronce',
      plata: 'Plata',
      oro: 'Oro',
    };
    return map[level] ?? level;
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.store.reset();
    await this.router.navigate(['/']);
  }
}
