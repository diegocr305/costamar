import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  ClubStaffService,
  type StaffLookup,
} from './club-staff.service';

type Step = 'scan' | 'review' | 'done';

@Component({
  selector: 'cm-club-validar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './club-validar.component.html',
  styleUrl: './club-validar.component.css',
})
export class ClubValidarComponent {
  private readonly staff = inject(ClubStaffService);

  protected readonly step = signal<Step>('scan');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected memberCodeInput = signal('');
  protected readonly lookup = signal<StaffLookup | null>(null);
  protected selectedCoupon = signal<string | null>(null);
  protected consumptionRef = signal('');

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
