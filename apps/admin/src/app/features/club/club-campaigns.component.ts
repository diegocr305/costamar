import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { chileLocalDateTime, chileLocalToIso, type CampaignAdmin, type CampaignProductRole, type CampaignStatus, type CampaignWrite } from '@costamar/shared';
import { CartaAdminService, type AdminProduct } from '../carta/carta-admin.service';
import { ClubCampaignsService, type CampaignCouponPage } from './club-campaigns.service';
import { environment } from '../../../environments/environment';

type Draft = CampaignWrite & { slug?: string; startLocal: string; endLocal: string };
const emptyDraft = (): Draft => ({ name: '', description: '', imagePath: '', benefit: '', status: 'draft', startsAt: null, endsAt: null, maxCoupons: null, validityDays: null, products: [], startLocal: '', endLocal: '' });

@Component({ selector: 'cm-club-campaigns', standalone: true, imports: [FormsModule, RouterLink], templateUrl: './club-campaigns.component.html', styleUrl: './club-campaigns.component.css' })
export class ClubCampaignsComponent implements OnInit {
  private readonly api = inject(ClubCampaignsService);
  private readonly carta = inject(CartaAdminService);
  protected readonly campaigns = signal<CampaignAdmin[]>([]);
  protected readonly catalogue = signal<AdminProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly view = signal<'list' | 'edit' | 'coupons'>('list');
  protected readonly selected = signal<CampaignAdmin | null>(null);
  protected readonly totals = computed(() => this.campaigns().reduce((sum, c) => ({ issued: sum.issued + c.stats.issued, redeemed: sum.redeemed + c.stats.redeemed, available: sum.available + c.stats.available }), { issued: 0, redeemed: 0, available: 0 }));
  protected readonly couponPage = signal<CampaignCouponPage>({ items: [], total: 0, page: 1, pageSize: 20 });
  protected readonly couponLoading = signal(false);
  protected readonly couponError = signal<string | null>(null);
  protected draft = emptyDraft();
  protected filter = '';
  protected couponStatus = '';
  protected couponSearch = '';
  protected productSearch = '';
  protected productChoice = '';
  protected productRole: CampaignProductRole = 'drink';
  protected readonly roles: CampaignProductRole[] = ['drink', 'dessert', 'gift'];
  private couponRequest = 0;
  ngOnInit(): void { void this.load(); }
  protected async load(): Promise<void> {
    this.loading.set(true); this.error.set(null);
    try { const result = await firstValueFrom(forkJoin({ campaigns: this.api.list(), products: this.carta.listProducts() })); this.campaigns.set(result.campaigns); this.catalogue.set(result.products); }
    catch { this.error.set('No pudimos cargar las campañas. Revisa tu conexión e inténtalo de nuevo.'); }
    finally { this.loading.set(false); }
  }
  protected visible() { return this.campaigns().filter(c => !this.filter || c.status === this.filter); }
  protected statusLabel(status: string): string { return ({ draft: 'Borrador', active: 'Activa', paused: 'Pausada', closed: 'Cerrada', issued: 'Disponible', redeemed: 'Canjeado', expired: 'Vencido', void: 'Anulado' } as Record<string, string>)[status] ?? status; }
  protected typeLabel(type: string): string { return type === 'birthday' ? 'Beneficio general · Cumpleaños' : type === 'founders' ? 'Bienvenida · Fundadores' : 'Promoción'; }
  protected roleLabel(role: CampaignProductRole): string { return { drink: 'Bebestible', dessert: 'Postre', gift: 'Regalo' }[role]; }
  protected image(path?: string | null): string { return !path ? '' : /^https:\/\//.test(path) ? path : `${environment.supabaseUrl}/storage/v1/object/public/media/${path}`; }
  protected date(iso?: string | null): string { return !iso ? 'Sin fecha definida' : new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }
  protected newCampaign(): void { this.selected.set(null); this.draft = emptyDraft(); this.openEditor(); }
  protected edit(c: CampaignAdmin): void {
    this.selected.set(c);
    this.draft = { name: c.name, description: c.description ?? '', imagePath: c.imagePath ?? '', benefit: String(c.rules['benefit'] ?? ''), status: c.status,
      startsAt: c.startsAt ?? null, endsAt: c.endsAt ?? null, maxCoupons: c.maxCoupons ?? null, validityDays: typeof c.rules['validityDays'] === 'number' ? c.rules['validityDays'] : null,
      products: c.products.map(p => ({ productId: p.productId, role: p.role })), startLocal: c.startsAt ? chileLocalDateTime(c.startsAt) : '', endLocal: c.endsAt ? chileLocalDateTime(c.endsAt) : '' };
    this.openEditor();
  }
  private openEditor(): void { this.error.set(null); this.message.set(null); this.productSearch = ''; this.productChoice = ''; this.view.set('edit'); window.scrollTo(0, 0); }
  protected back(): void { this.couponRequest++; this.view.set('list'); this.error.set(null); this.couponError.set(null); window.scrollTo(0, 0); }
  protected productOptions() { return this.catalogue().filter(p => p.name.toLocaleLowerCase('es').includes(this.productSearch.trim().toLocaleLowerCase('es'))); }
  protected productName(id: string): string { return this.catalogue().find(p => p.id === id)?.name ?? 'Producto'; }
  protected addProduct(): void {
    if (!this.productChoice || this.draft.products.some(p => p.productId === this.productChoice && p.role === this.productRole)) return;
    this.draft.products = [...this.draft.products, { productId: this.productChoice, role: this.productRole }]; this.productChoice = '';
  }
  protected removeProduct(index: number): void { this.draft.products = this.draft.products.filter((_p, i) => i !== index); }
  private upsert(c: CampaignAdmin): void { this.campaigns.update(list => list.some(p => p.id === c.id) ? list.map(p => p.id === c.id ? c : p) : [...list, c]); }
  protected async save(): Promise<void> {
    if (this.saving()) return;
    const birthday = this.selected()?.type === 'birthday';
    const start = this.draft.startLocal ? chileLocalToIso(this.draft.startLocal) : null;
    const end = this.draft.endLocal ? chileLocalToIso(this.draft.endLocal) : null;
    if ((this.draft.startLocal && !start) || (this.draft.endLocal && !end)) { this.error.set('Revisa las fechas: esa hora no existe en el calendario de Chile.'); return; }
    if (start && end && start >= end) { this.error.set('El término debe ser posterior al inicio.'); return; }
    if (!this.selected() && !this.draft.slug) {
      const slug = this.draft.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'promocion';
      this.draft.slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
    }
    const input: CampaignWrite & { slug?: string } = {
      name: this.draft.name.trim(), description: this.draft.description?.trim() || null, imagePath: this.draft.imagePath?.trim() || null,
      status: this.draft.status, startsAt: start, endsAt: end, maxCoupons: birthday ? null : this.draft.maxCoupons,
      validityDays: birthday ? null : this.draft.validityDays, benefit: this.draft.benefit.trim(), products: this.draft.products,
      ...(!this.selected() ? { slug: this.draft.slug } : {}),
    };
    this.saving.set(true); this.error.set(null);
    try { const campaign = await firstValueFrom(this.api.save(this.selected()?.id ?? null, input)); this.upsert(campaign); this.back(); this.message.set('Campaña guardada. Los cambios de vigencia se aplican a nuevos cupones.'); }
    catch (err) { this.error.set(this.errorText(err, 'No pudimos guardar la campaña. Inténtalo de nuevo.')); }
    finally { this.saving.set(false); }
  }
  protected async changeStatus(c: CampaignAdmin, status: CampaignStatus): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true); this.error.set(null); this.message.set(null);
    try { this.upsert(await firstValueFrom(this.api.status(c.id, status))); this.message.set(`${c.name}: ${this.statusLabel(status).toLowerCase()}. Los cupones emitidos conservan su vigencia.`); }
    catch (err) { this.error.set(this.errorText(err, 'No pudimos cambiar el estado.')); }
    finally { this.saving.set(false); }
  }
  protected openCoupons(c: CampaignAdmin): void { this.selected.set(c); this.couponStatus = ''; this.couponSearch = ''; this.view.set('coupons'); window.scrollTo(0, 0); void this.loadCoupons(); }
  protected setCouponStatus(status: string): void {
    this.couponStatus = status;
    void this.loadCoupons(1);
  }
  protected async loadCoupons(page = 1): Promise<void> {
    const c = this.selected(); if (!c) return;
    const request = ++this.couponRequest; this.couponLoading.set(true); this.couponError.set(null);
    try { const result = await firstValueFrom(this.api.coupons(c.id, this.couponStatus, this.couponSearch, page)); if (request === this.couponRequest) this.couponPage.set(result); }
    catch (err) { if (request === this.couponRequest) this.couponError.set(this.errorText(err, 'No pudimos cargar los cupones.')); }
    finally { if (request === this.couponRequest) this.couponLoading.set(false); }
  }
  private errorText(err: unknown, fallback: string): string { const e = err as { error?: { message?: unknown } }; return typeof e.error?.message === 'string' ? e.error.message : fallback; }
}
