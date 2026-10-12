import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ClubStaffService, type RedemptionHistory } from './club-staff.service';

function todayInChile(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(key => parts.find(p => p.type === key)?.value).join('-');
}

@Component({
  selector: 'cm-club-history', standalone: true, imports: [RouterLink, FormsModule],
  templateUrl: './club-history.component.html', styleUrl: './club-history.component.css',
})
export class ClubHistoryComponent implements OnInit {
  private readonly staff = inject(ClubStaffService);
  protected readonly result = signal<RedemptionHistory>({ items: [], total: 0, page: 1, pageSize: 20 });
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected date = todayInChile();
  protected query = '';
  private requestId = 0;
  ngOnInit(): void { void this.load(); }
  protected async load(page = 1): Promise<void> {
    const request = ++this.requestId;
    this.loading.set(true); this.error.set(false);
    try {
      const result = await firstValueFrom(this.staff.history(this.date, this.query, page));
      if (request === this.requestId) this.result.set(result);
    } catch { if (request === this.requestId) this.error.set(true); }
    finally { if (request === this.requestId) this.loading.set(false); }
  }
  protected showToday(): void { this.date = todayInChile(); this.query = ''; void this.load(); }
  protected showAll(): void { this.date = ''; void this.load(); }
  protected timestamp(iso: string): string {
    return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  }
}
