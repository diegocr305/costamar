import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

const EMPTY: ReminderPage = { items: [], total: 0, page: 1, pageSize: 20, summary: { pending: 0, sent: 0, failed: 0, skipped: 0 } };

@Component({
  selector: 'cm-club-reminders', standalone: true, imports: [FormsModule],
  templateUrl: './club-reminders.component.html', styleUrl: './club-reminders.component.css',
})
export class ClubRemindersComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly source = signal<Source>('expiry');
  protected readonly result = signal<ReminderPage>(EMPTY);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected channel = '';
  protected kind = '';
  protected status = '';
  protected query = '';
  private requestId = 0;
  private readonly statusText: Record<string, string> = { pending: 'Pendiente', sent: 'Enviado', failed: 'Fallido', skipped: 'Omitido' };

  ngOnInit(): void { void this.load(); }

  protected switchSource(source: Source): void {
    if (source === this.source()) return;
    this.source.set(source);
    this.channel = ''; this.kind = ''; this.status = ''; this.query = '';
    this.result.set(EMPTY);
    void this.load();
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
    if (r.kind) return r.kind === 'birthday' ? 'Cumpleaños' : 'Bienvenida';
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
