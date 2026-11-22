import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Fila común: recordatorio de vencimiento (channel) o correo de cumpleaños/bienvenida (kind). */
export interface ReminderRow {
  id: string; channel?: 'email' | 'whatsapp'; kind?: 'birthday' | 'welcome';
  status: 'pending' | 'sent' | 'failed' | 'skipped'; detail: string | null;
  createdAt: string; sentAt: string | null; couponCode: string; expiresAt: string | null; campaignName: string;
  memberName: string; memberCode: string | null; contact: string | null;
}
export interface ReminderPage {
  items: ReminderRow[]; total: number; page: number; pageSize: number;
  summary: { pending: number; sent: number; failed: number; skipped: number };
}
type Source = 'expiry' | 'emails';
export interface MemberWhatsapp {
  id: string; kind: 'birthday' | 'welcome'; couponCode: string; expiresAt: string | null;
  memberName: string; memberCode: string | null; phone: string; campaignName: string;
  benefit: string | null; options: string[];
}

const EMPTY: ReminderPage = { items: [], total: 0, page: 1, pageSize: 20, summary: { pending: 0, sent: 0, failed: 0, skipped: 0 } };

@Component({
  selector: 'cm-club-reminders', standalone: true, imports: [FormsModule],
  templateUrl: './club-reminders.component.html', styleUrl: './club-reminders.component.css',
})
export class ClubRemindersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly source = signal<Source>('expiry');
  protected readonly result = signal<ReminderPage>(EMPTY);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly whatsapp = signal<MemberWhatsapp[]>([]);
  protected readonly whatsappError = signal('');
  protected readonly opened = signal<Record<string, true>>({});
  protected channel = '';
  protected kind = '';
  protected status = '';
  protected query = '';
  private requestId = 0;
  private readonly statusText: Record<string, string> = { pending: 'Pendiente', sent: 'Enviado', failed: 'Fallido', skipped: 'Omitido' };

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'whatsapp' || tab === 'emails') { this.source.set('emails'); void this.loadWhatsapp(); }
    void this.load();
  }

  protected switchSource(source: Source): void {
    if (source === this.source()) return;
    this.source.set(source);
    this.channel = ''; this.kind = ''; this.status = ''; this.query = '';
    this.result.set(EMPTY);
    void this.load();
    if (source === 'emails') void this.loadWhatsapp();
  }

  protected async loadWhatsapp(): Promise<void> {
    this.whatsappError.set('');
    try {
      this.whatsapp.set(await firstValueFrom(this.http.get<MemberWhatsapp[]>(`${environment.apiUrl}/club/admin/member-whatsapp`)));
    } catch { this.whatsappError.set('No pudimos cargar los avisos por WhatsApp.'); }
  }

  /** Abre WhatsApp (en el celular, la app con el número de Costa Mar) con el mensaje ya escrito. */
  protected whatsappLink(w: MemberWhatsapp): string {
    const name = w.memberName.trim().split(/\s+/)[0] || '';
    const until = w.expiresAt
      ? new Date(Date.parse(w.expiresAt) - 1000).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: 'numeric', month: 'long' })
      : null;
    const benefit = w.benefit || w.campaignName;
    const code = w.memberCode ? ` Tu código de socio es ${w.memberCode}.` : '';
    const validity = until ? ` Es válido hasta el ${until}, con consumo en el local.` : ' Es válido con consumo en el local.';
    const howTo = ' Al pedir, abre tu cupón en club.restaurantecostamar.cl/cupones y muéstralo a quien te atienda.';
    let text: string;
    if (w.kind === 'birthday') {
      text = `¡Feliz cumpleaños, ${name}! 🎉 Te saluda Costa Mar Barra Cevichera. Este mes tienes de regalo tu Barco Cumpleañero: ${benefit}.${validity}${code}${howTo}`;
    } else {
      const options = (w.options ?? []).map(o => String(o).replace(/\s+individual$/i, '')).filter(Boolean);
      const choice = options.length > 1 ? ` Puedes elegir ${options.slice(0, -1).join(', ')} o ${options[options.length - 1]}.` : '';
      text = `¡Bienvenido al Club Costa Mar, ${name}! Gracias por ser socio fundador. Tu regalo de bienvenida es ${benefit}.${choice}${validity}${code}${howTo}`;
    }
    return `https://wa.me/${w.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  }
  protected markOpened(w: MemberWhatsapp): void { this.opened.set({ ...this.opened(), [w.id]: true }); }
  protected async markWhatsappSent(w: MemberWhatsapp): Promise<void> {
    this.whatsappError.set('');
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/club/admin/member-whatsapp/${w.id}/sent`, {}));
      this.whatsapp.set(this.whatsapp().filter(x => x.id !== w.id));
      void this.load(this.result().page);
    } catch { this.whatsappError.set('No pudimos registrar el aviso. Inténtalo de nuevo.'); }
  }

  protected async load(page = 1): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true); this.error.set(false);
    const emails = this.source() === 'emails';
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (!emails && this.channel) params = params.set('channel', this.channel);
    if (emails && this.kind) params = params.set('kind', this.kind);
    if (this.status) params = params.set('status', this.status);
    if (this.query.trim()) params = params.set('q', this.query.trim());
    const url = `${environment.apiUrl}/club/admin/${emails ? 'member-emails' : 'reminders'}`;
    try {
      const result = await firstValueFrom(this.http.get<ReminderPage>(url, { params }));
      if (request === this.requestId) this.result.set(result);
    } catch { if (request === this.requestId) this.error.set(true); }
    finally { if (request === this.requestId) this.loading.set(false); }
  }
  protected label(status: string): string { return this.statusText[status] ?? status; }
  protected typeLabel(r: ReminderRow): string {
    if (r.kind) return (r.kind === 'birthday' ? 'Cumpleaños' : 'Bienvenida') + (r.channel === 'whatsapp' ? ' · WhatsApp' : ' · Correo');
    return r.channel === 'email' ? 'Correo' : 'WhatsApp';
  }
  protected timestamp(iso: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
  protected day(iso: string | null): string {
    if (!iso) return 'Sin vencimiento';
    return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
  }
}
