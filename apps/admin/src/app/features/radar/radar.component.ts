import {
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  inject,
  signal,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpClient, HttpParams } from "@angular/common/http";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, timeout } from "rxjs";
import {
  RADAR_STAGES,
  RADAR_REGIONS,
  chileLocalDateTime,
  chileLocalToIso,
  resolveRadarDeadline,
  deadlineRemaining,
  closingIn24Hours,
} from "@costamar/shared";
import type {
  RadarAlert,
  RadarList,
  RadarOpportunity,
  RadarProfile,
  RadarStatus,
  RadarGeneralList,
  RadarGeneralItem,
} from "@costamar/shared";
import { environment } from "../../../environments/environment";
type Detail = RadarOpportunity & {
  uploads: { id: string; name: string; size: number; created_at: string }[];
  changes: { id: number; created_at: string }[];
};
@Component({
  selector: "cm-radar",
  standalone: true,
  imports: [FormsModule],
  templateUrl: "./radar.component.html",
  styleUrl: "./radar.component.css",
})
export class RadarComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly base = environment.apiUrl + "/radar";
  private listRequest = 0;
  private detailRequest = 0;
  private destroyed = false;
  private timer?: ReturnType<typeof setInterval>;
  private clockTimer?: ReturnType<typeof setInterval>;
  private clockOffset = 0;
  protected readonly clock = signal(Date.now());
  private returnFocus: HTMLElement | null = null;
  protected readonly stages = RADAR_STAGES;
  protected readonly regions = RADAR_REGIONS;
  protected tab = "opportunities";
  protected loading = signal(false);
  protected detailLoading = signal(false);
  protected saving = signal(false);
  protected error = signal("");
  protected detailError = signal("");
  protected notice = signal("");
  protected healthError = signal("");
  protected result = signal<RadarList>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  protected selected = signal<Detail | null>(null);
  protected status = signal<RadarStatus | null>(null);
  protected profiles = signal<RadarProfile[]>([]);
  protected alerts = signal<RadarAlert[]>([]);
  protected q = "";
  protected source = "";
  protected officialStatus = "publicada";
  protected stageFilter = "";
  protected commune = "";
  protected profileFilter = "";
  protected matchFilter = "recommended";
  protected generalSource = "compra_agil";
  protected generalRegion: number | null = null;
  protected generalQuery = "";
  protected generalLoading = signal(false);
  protected generalError = signal("");
  protected generalResult = signal<RadarGeneralList | null>(null);
  private generalRequest = 0;
  protected favoriteOnly = false;
  protected closingOnly = false;
  protected regionFilter: number | null = null;
  protected sortFilter = 'newest';
  protected minBudget: number | null = null;
  protected maxBudget: number | null = null;
  protected editStage = "Nueva";
  protected editNotes = "";
  protected editFavorite = false;
  protected verifiedClose = "";
  protected closeVerified = false;
  protected profileId = "";
  protected profileName = "";
  protected profileEnabled = true;
  protected profileRegions: number[] = [5];
  protected profileKeywords = "";
  protected profileExcluded = "";
  protected profileCommunes = "";
  protected profileMin: number | null = null;
  protected profileMax: number | null = null;
  protected profileUnknown = true;
  protected profileLicitaciones = true;
  protected profileError = signal("");
  ngOnInit() {
    void this.load();
    void this.loadProfiles();
    void this.health();
    this.timer = setInterval(() => void this.health(), 45000);
    this.clockTimer = setInterval(() => this.clock.set(Date.now() + this.clockOffset), 30000);
    const id = this.route.snapshot.queryParamMap.get("opportunity");
    if (id && /^[a-f0-9-]{36}$/i.test(id)) void this.open(id);
  }
  ngOnDestroy() {
    this.destroyed = true;
    this.listRequest++;
    this.detailRequest++;
    this.generalRequest++;
    document.body.style.overflow = "";
    if (this.timer) clearInterval(this.timer);
    if (this.clockTimer) clearInterval(this.clockTimer);
  }
  @HostListener("document:keydown.escape") escape() {
    if (this.selected() || this.detailLoading() || this.detailError())
      this.close();
  }
  protected trap(event: KeyboardEvent) {
    if (event.key !== "Tab") return;
    const panel = event.currentTarget as HTMLElement;
    const nodes = Array.from(
      panel.querySelectorAll<HTMLElement>(
        "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
      ),
    ).filter((x) => x.getClientRects().length > 0);
    const first = nodes[0],
      last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  protected money(row: RadarOpportunity) {
    return row.budget === null
      ? "Presupuesto no informado"
      : new Intl.NumberFormat("es-CL", {
          maximumFractionDigits: row.currency === "CLP" ? 0 : 2,
        }).format(row.budget) +
          " " +
          (row.currency || "moneda por verificar");
  }
  protected time(value: string | null | undefined) {
    return value && Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString("es-CL", {
          timeZone: "America/Santiago",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "Sin revisión todavía";
  }
  protected deadline(row: RadarOpportunity | RadarGeneralItem) { return resolveRadarDeadline(row); }
  protected remaining(row: RadarOpportunity | RadarGeneralItem) { return deadlineRemaining(this.deadline(row).iso, this.clock()); }
  protected urgent(row: RadarOpportunity | RadarGeneralItem) { return row.official_status === 'publicada' && closingIn24Hours(this.deadline(row).iso, this.clock()); }
  protected stale() {
    const s = this.status();
    return (
      !!s &&
      (!s.last_success_at ||
        Date.now() - new Date(s.last_success_at).getTime() > 1800000 ||
        !!s.last_error)
    );
  }
  protected healthNotice() {
    const s = this.status();
    if (!s) return "";
    if (!s.configured)
      return "Falta activar el acceso a Mercado Público. Las oportunidades aparecerán después de la primera revisión.";
    if (s.last_error)
      return `${s.last_error} Conservamos la última información disponible.`;
    if (this.workerMissing())
      return "La revisión automática no está activa o no ha informado recientemente. Puedes seguir consultando las oportunidades guardadas.";
    if (this.stale() && s.last_success_at)
      return "La información necesita actualizarse. Comprueba la ficha oficial antes de cotizar.";
    return "";
  }
  protected paused() {
    const until = this.status()?.blocked_until;
    return !!until && Date.parse(until) > Date.now();
  }
  protected workerMissing() {
    const t = this.status()?.worker_seen_at;
    return !t || Date.now() - new Date(t).getTime() > 120000;
  }
  protected preferred(row: RadarOpportunity) {
    const place = (row.delivery || row.buyer_commune)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return this.profiles().some(
      (p) =>
        row.profile_ids.includes(p.id) &&
        p.preferred_communes.some((c) =>
          place.includes(
            c
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase(),
          ),
        ),
    );
  }
  protected sourceName(value: string) {
    return value === "compra_agil" ? "Compra Ágil" : "Licitación";
  }
  protected classification(row: RadarOpportunity) {
    return row.match_kind === "review"
      ? "Por revisar"
      : row.match_kind === "manual"
        ? "Selección manual"
        : "Coincidencia del perfil";
  }
  protected bucket(kind:string){this.matchFilter=kind;void this.load();}
  protected closingChanged() { if(this.closingOnly) this.sortFilter='closing'; void this.load(); }
  protected generalScope() {
    return this.generalSource === "licitacion"
      ? "Licitaciones · Todo Chile"
      : this.generalRegion === null
        ? "Compras Ágiles · Todo Chile"
        : `Compras Ágiles · ${this.regionNames([this.generalRegion])}`;
  }
  protected async loadGeneral(page = 1, refresh = false) {
    const request = ++this.generalRequest;
    this.generalLoading.set(true);
    this.generalError.set("");
    let params = new HttpParams()
      .set("source", this.generalSource)
      .set("page", page)
      .set("q", this.generalQuery.trim())
      .set("refresh", String(refresh));
    if (this.generalSource === "compra_agil" && this.generalRegion !== null)
      params = params.set("region", this.generalRegion);
    try {
      const result = await firstValueFrom(
        this.http
          .get<RadarGeneralList>(this.base + "/general", { params })
          .pipe(timeout(50000)),
      );
      if (request === this.generalRequest) this.generalResult.set(result);
    } catch (e) {
      if (request === this.generalRequest) {
        this.generalResult.set(null);
        this.generalError.set(
          this.errorText(
            e,
            "No pudimos obtener el listado general. Inténtalo de nuevo.",
          ),
        );
      }
    } finally {
      if (request === this.generalRequest) this.generalLoading.set(false);
    }
  }
  protected changeGeneralSource(source: string) {
    this.generalSource = source;
    this.generalResult.set(null);
    void this.loadGeneral();
  }
  protected async openGeneral(row: RadarGeneralItem) {
    if (this.saving()) return;
    this.saving.set(true);
    this.generalError.set("");
    try {
      const result = await firstValueFrom(
        this.http
          .post<{
            id: string;
          }>(`${this.base}/general/${row.source}/${row.code}/import`, {})
          .pipe(timeout(50000)),
      );
      this.saving.set(false);
      await this.open(result.id);
      this.notice.set("Oportunidad guardada desde el listado general.");
    } catch (e) {
      this.generalError.set(this.errorText(e, "No pudimos abrir esta ficha."));
    } finally {
      this.saving.set(false);
    }
  }
  protected regionNames(codes: number[]) {
    return codes
      .map(
        (code) =>
          this.regions.find((x) => x.code === code)?.name ?? String(code),
      )
      .join(", ");
  }
  protected chooseRegion(code: number, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.profileRegions = checked
      ? [...this.profileRegions, code]
      : this.profileRegions.filter((x) => x !== code);
  }
  protected initialScan() {
    return this.status()?.cursors.some((x) => x.mode === "bootstrap") ?? false;
  }
  protected errorText(error: any, fallback: string) {
    return typeof error?.error?.message === "string"
      ? error.error.message
      : fallback;
  }
  protected async load(page = 1) {
    const request = ++this.listRequest;
    this.loading.set(true);
    this.error.set("");
    let params = new HttpParams()
      .set("page", page)
      .set("q", this.q.trim())
      .set("source", this.source)
      .set("status", this.officialStatus)
      .set("stage", this.stageFilter)
      .set("match", this.matchFilter)
      .set("commune", this.commune.trim())
      .set("favorite", String(this.favoriteOnly))
      .set("closing", String(this.closingOnly));
    params = params.set('sort', this.sortFilter);
    if (this.regionFilter !== null) params = params.set('region', this.regionFilter);
    if (this.profileFilter) params = params.set("profile", this.profileFilter);
    if (this.minBudget !== null)
      params = params.set("minBudget", this.minBudget);
    if (this.maxBudget !== null)
      params = params.set("maxBudget", this.maxBudget);
    try {
      const row = await firstValueFrom(
        this.http
          .get<RadarList>(this.base + "/opportunities", { params })
          .pipe(timeout(20000)),
      );
      if (request === this.listRequest) {
        this.result.set(row);
        this.clockOffset = row.asOf ? Date.parse(row.asOf) - Date.now() : 0;
        this.clock.set(Date.now() + this.clockOffset);
      }
    } catch (e) {
      if (request === this.listRequest)
        this.error.set(
          this.errorText(
            e,
            "No pudimos cargar las oportunidades. Inténtalo de nuevo.",
          ),
        );
    } finally {
      if (request === this.listRequest) this.loading.set(false);
    }
  }
  private async loadProfiles() {
    try {
      const p = await firstValueFrom(
        this.http
          .get<RadarProfile[]>(this.base + "/profiles")
          .pipe(timeout(20000)),
      );
      if (!this.destroyed) this.profiles.set(p);
    } catch {
      if (!this.destroyed)
        this.profileError.set("No pudimos cargar los perfiles.");
    }
  }
  protected async health() {
    try {
      const s = await firstValueFrom(
        this.http
          .get<RadarStatus>(this.base + "/sync/status")
          .pipe(timeout(20000)),
      );
      if (!this.destroyed) {
        this.status.set(s);
        this.healthError.set("");
      }
    } catch {
      if (!this.destroyed)
        this.healthError.set("No pudimos comprobar la actualización de Radar.");
    }
  }
  protected async sync() {
    this.saving.set(true);
    this.notice.set("");
    try {
      const r = await firstValueFrom(
        this.http
          .post<{ queued: boolean }>(this.base + "/sync", {})
          .pipe(timeout(20000)),
      );
      this.notice.set(
        r.queued
          ? "Revisión solicitada. Actualiza la lista cuando termine."
          : "Ya se solicitó una revisión hace poco.",
      );
      await this.health();
    } catch (e) {
      this.error.set(this.errorText(e, "No pudimos solicitar la revisión."));
    } finally {
      this.saving.set(false);
    }
  }
  protected async open(id: string) {
    if (this.saving()) return;
    if (!this.selected()) {
      this.returnFocus = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
    }
    const request = ++this.detailRequest;
    this.detailLoading.set(true);
    this.detailError.set("");
    try {
      const row = await firstValueFrom(
        this.http
          .get<Detail>(this.base + "/opportunities/" + id)
          .pipe(timeout(20000)),
      );
      if (request === this.detailRequest) {
        this.selected.set(row);
        this.editStage = row.stage;
        this.editNotes = row.notes;
        this.editFavorite = row.favorite;
        this.verifiedClose = row.verified_closes_at
          ? chileLocalDateTime(row.verified_closes_at)
          : row.closes_at
            ? chileLocalDateTime(row.closes_at)
            : row.closes_raw.replace(" ", "T").slice(0, 16);
        this.closeVerified = !!row.verified_closes_at;
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { opportunity: id },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
    } catch (e) {
      if (request === this.detailRequest) {
        this.selected.set(null);
        this.detailError.set(this.errorText(e, "No pudimos abrir esta ficha."));
      }
    } finally {
      if (request === this.detailRequest) {
        this.detailLoading.set(false);
        setTimeout(() => {
          if (!this.destroyed && request === this.detailRequest)
            document.querySelector<HTMLElement>(".detail-head button")?.focus();
        }, 0);
      }
    }
  }
  protected close() {
    if (this.saving()) return;
    this.detailRequest++;
    this.selected.set(null);
    this.detailLoading.set(false);
    this.detailError.set("");
    document.body.style.overflow = "";
    this.returnFocus?.focus();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { opportunity: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }
  protected async saveTracking() {
    const row = this.selected();
    if (!row) return;
    this.saving.set(true);
    this.detailError.set("");
    const patch: any = {
      stage: this.editStage,
      notes: this.editNotes,
      favorite: this.editFavorite,
      expected_updated_at: row.tracking_updated_at ?? "none",
    };
    if (this.closeVerified) {
      const iso = chileLocalToIso(this.verifiedClose);
      if (!iso) {
        this.detailError.set("Revisa la fecha y hora de cierre confirmadas.");
        this.saving.set(false);
        return;
      }
      patch.verified_closes_at = iso;
    } else if (row.verified_closes_at) patch.clear_verified_close = true;
    try {
      const updated = await firstValueFrom(
        this.http
          .patch<RadarOpportunity>(
            this.base + "/opportunities/" + row.id + "/tracking",
            patch,
          )
          .pipe(timeout(20000)),
      );
      this.selected.set({ ...row, ...updated });
      this.notice.set("Seguimiento guardado.");
      void this.load(this.result().page);
    } catch (e) {
      this.detailError.set(
        this.errorText(e, "No pudimos guardar el seguimiento."),
      );
    } finally {
      this.saving.set(false);
    }
  }
  protected async switchTab(tab: string) {
    this.tab = tab;
    if (tab === "opportunities") void this.load();
    if (tab === "general") await this.loadGeneral();
    if (tab === "alerts") await this.loadAlerts();
    if (tab === "profiles") await this.loadProfiles();
  }
  protected async loadAlerts() {
    this.loading.set(true);
    this.error.set("");
    try {
      const a = await firstValueFrom(
        this.http.get<RadarAlert[]>(this.base + "/alerts").pipe(timeout(20000)),
      );
      if (!this.destroyed) this.alerts.set(a);
    } catch {
      this.error.set("No pudimos cargar los avisos.");
    } finally {
      this.loading.set(false);
    }
  }
  protected async read(alert: RadarAlert) {
    try {
      await firstValueFrom(
        this.http
          .patch(this.base + "/alerts/" + alert.id + "/read", {})
          .pipe(timeout(20000)),
      );
      this.alerts.update((rows) =>
        rows.map((x) =>
          x.id === alert.id ? { ...x, read_at: new Date().toISOString() } : x,
        ),
      );
      void this.health();
    } catch {
      this.error.set("No pudimos marcar el aviso como leído.");
    }
  }
  protected editProfile(p?: RadarProfile) {
    this.profileId = p?.id ?? "";
    this.profileName = p?.name ?? "";
    this.profileEnabled = p?.enabled ?? true;
    this.profileRegions = [...(p?.regions ?? [5])];
    this.profileKeywords = p?.keywords.join(", ") ?? "";
    this.profileExcluded = p?.exclude_keywords.join(", ") ?? "";
    this.profileCommunes = p?.preferred_communes.join(", ") ?? "";
    this.profileMin = p?.min_budget ?? null;
    this.profileMax = p?.max_budget ?? null;
    this.profileUnknown = p?.include_unknown_budget ?? true;
    this.profileLicitaciones = p?.include_licitaciones ?? true;
    this.profileError.set("");
  }
  protected async saveProfile() {
    this.saving.set(true);
    this.profileError.set("");
    const split = (text: string) =>
      text
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    const data = {
      name: this.profileName.trim(),
      enabled: this.profileEnabled,
      regions: this.profileRegions,
      keywords: split(this.profileKeywords),
      exclude_keywords: split(this.profileExcluded),
      preferred_communes: split(this.profileCommunes),
      min_budget: this.profileMin,
      max_budget: this.profileMax,
      include_unknown_budget: this.profileUnknown,
      include_licitaciones: this.profileLicitaciones,
    };
    try {
      const p = await firstValueFrom(
        (this.profileId
          ? this.http.patch<RadarProfile>(
              this.base + "/profiles/" + this.profileId,
              data,
            )
          : this.http.post<RadarProfile>(this.base + "/profiles", data)
        ).pipe(timeout(20000)),
      );
      this.editProfile(p);
      await this.loadProfiles();
      this.notice.set(
        "Perfil guardado. La siguiente revisión aplicará estos criterios.",
      );
    } catch (e) {
      this.profileError.set(this.errorText(e, "Revisa los datos del perfil."));
    } finally {
      this.saving.set(false);
    }
  }
  protected async upload(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0],
      row = this.selected();
    if (!file || !row) return;
    if (file.size > 10485760) {
      this.detailError.set("El documento debe pesar hasta 10 MB.");
      input.value = "";
      return;
    }
    this.saving.set(true);
    this.detailError.set("");
    const body = new FormData();
    body.append("file", file);
    try {
      const doc = await firstValueFrom(
        this.http
          .post<
            Detail["uploads"][number]
          >(this.base + "/opportunities/" + row.id + "/documents", body)
          .pipe(timeout(60000)),
      );
      this.selected.update((current) =>
        current?.id === row.id
          ? { ...current, uploads: [doc, ...current.uploads] }
          : current,
      );
      this.notice.set("Documento guardado para revisión.");
    } catch (e) {
      this.detailError.set(
        this.errorText(e, "No pudimos guardar el documento."),
      );
    } finally {
      this.saving.set(false);
      input.value = "";
    }
  }
  protected async download(id: string) {
    const row = this.selected();
    if (!row) return;
    try {
      const data = await firstValueFrom(
        this.http
          .get<{
            signedUrl: string;
          }>(this.base + "/opportunities/" + row.id + "/documents/" + id)
          .pipe(timeout(20000)),
      );
      const url = new URL(data.signedUrl);
      if (
        url.origin !== new URL(environment.supabaseUrl).origin ||
        url.protocol !== "https:"
      )
        throw new Error();
      window.location.assign(data.signedUrl);
    } catch {
      this.detailError.set("No pudimos descargar el documento.");
    }
  }
}
