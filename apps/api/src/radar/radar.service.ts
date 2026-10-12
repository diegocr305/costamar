import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import { SupabaseService } from "../supabase/supabase.service";
import { RadarProfileDto, RadarQueryDto, RadarTrackingDto } from "./radar.dto";
import { fold } from "./radar.normalize";
const columns =
  "id,source,code,name,description,official_status,buyer,buyer_rut,region,buyer_commune,delivery,delivery_days,budget,currency,budget_type,call_number,closes_raw,closes_at,verified_closes_at,published_raw,source_changed_raw,checked_at,detail_checked_at,created_at,items,documents,profile_ids,stage,favorite,notes,tracking_updated_at";
export function safeFilter(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s-]/gu, "").trim();
}
export function emailConfiguration(config: ConfigService) {
  const recipients = (config.get<string>("RADAR_EMAIL_TO") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const ready =
    !!config.get("RESEND_API_KEY") &&
    !!config.get("RADAR_EMAIL_FROM") &&
    recipients.length > 0 &&
    recipients.length <= 5 &&
    recipients.every((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  return {
    ready,
    enabled: config.get("RADAR_EMAIL_ENABLED") === "true",
    recipients,
  };
}
@Injectable()
export class RadarService {
  constructor(
    private readonly db: SupabaseService,
    private readonly config: ConfigService,
  ) {}
  private check<T>(result: { data: T; error: any }): T {
    if (result.error)
      throw new ServiceUnavailableException(
        "Radar no está disponible. Revisa la migración y vuelve a intentar.",
      );
    return result.data;
  }
  async list(dto: RadarQueryDto) {
    if (dto.minBudget !== undefined && dto.maxBudget !== undefined && dto.maxBudget < dto.minBudget) {
      throw new BadRequestException('El presupuesto máximo debe ser mayor o igual al mínimo.');
    }
    const page = dto.page ?? 1,
      pageSize = 20;
    let query = this.db.client
      .from("radar_opportunities")
      .select(columns, { count: "exact" });
    const q = fold(safeFilter(dto.q ?? ""));
    if (q) query = query.ilike("search_text", `%${q}%`);
    const commune = fold(safeFilter(dto.commune ?? ""));
    if (commune) query = query.ilike("delivery_search", `%${commune}%`);
    if (dto.source) query = query.eq("source", dto.source);
    if (dto.status) query = query.eq("official_status", dto.status);
    if (dto.stage) query = query.eq("stage", dto.stage);
    if (dto.favorite === "true") query = query.eq("favorite", true);
    if (dto.profile) query = query.contains("profile_ids", [dto.profile]);
    if (dto.minBudget !== undefined) query = query.gte("budget", dto.minBudget);
    if (dto.maxBudget !== undefined) query = query.lte("budget", dto.maxBudget);
    if (dto.minBudget !== undefined || dto.maxBudget !== undefined)
      query = query.eq("currency", "CLP");
    if (dto.closing === "true") {
      const now = new Date().toISOString(),
        end = new Date(Date.now() + 86400000).toISOString();
      query = query
        .eq("official_status", "publicada")
        .or(
          `and(verified_closes_at.gte.${now},verified_closes_at.lte.${end}),and(verified_closes_at.is.null,closes_at.gte.${now},closes_at.lte.${end})`,
        );
    }
    const result = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * pageSize, page * pageSize - 1);
    return {
      items: this.check(result),
      total: result.count ?? 0,
      page,
      pageSize,
    };
  }
  async detail(id: string) {
    const row = this.check(
      await this.db.client
        .from("radar_opportunities")
        .select(columns)
        .eq("id", id)
        .maybeSingle(),
    );
    if (!row) throw new NotFoundException("No encontramos esa oportunidad.");
    const uploads = this.check(
      await this.db.client
        .from("radar_uploads")
        .select("id,name,content_type,size,created_at")
        .eq("opportunity_id", id)
        .order("created_at", { ascending: false }),
    );
    const changes = this.check(
      await this.db.client
        .from("radar_versions")
        .select("id,created_at")
        .eq("opportunity_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    );
    return { ...row, uploads, changes };
  }
  async tracking(actor: string, id: string, dto: RadarTrackingDto) {
    const current = this.check(
      await this.db.client
        .from("radar_opportunities")
        .select("tracking_updated_at,closes_raw")
        .eq("id", id)
        .maybeSingle(),
    );
    if (!current)
      throw new NotFoundException("No encontramos esa oportunidad.");
    if (
      dto.verified_closes_at &&
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(dto.verified_closes_at)
    )
      throw new BadRequestException(
        "La fecha confirmada necesita zona horaria.",
      );
    const { expected_updated_at, clear_verified_close, ...patch } = dto;
    let query = this.db.client
      .from("radar_opportunities")
      .update({
        ...patch,
        ...(clear_verified_close ? { verified_closes_at: null } : {}),
        tracked_by: actor,
        tracking_updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("closes_raw", current.closes_raw);
    query =
      expected_updated_at === "none"
        ? query.is("tracking_updated_at", null)
        : query.eq("tracking_updated_at", expected_updated_at);
    const result = this.check(await query.select(columns).maybeSingle());
    if (!result)
      throw new ConflictException(
        "La ficha cambió mientras la editabas. Recárgala antes de guardar.",
      );
    return result;
  }
  async profiles() {
    return this.check(
      await this.db.client.from("radar_profiles").select("*").order("name"),
    );
  }
  async saveProfile(dto: RadarProfileDto, id?: string) {
    if (
      !dto.name.trim() ||
      dto.keywords.some((x) => !x.trim()) ||
      dto.exclude_keywords.some((x) => !x.trim()) ||
      dto.preferred_communes.some((x) => !x.trim())
    )
      throw new BadRequestException(
        "Completa el nombre y las palabras de búsqueda.",
      );
    if (
      dto.min_budget !== null &&
      dto.max_budget !== null &&
      dto.max_budget < dto.min_budget
    )
      throw new BadRequestException(
        "El presupuesto máximo debe ser mayor o igual al mínimo.",
      );
    const patch = {
      ...dto,
      name: dto.name.trim(),
      regions: [...new Set(dto.regions)],
      keywords: dto.keywords.map((x) => x.trim()),
      exclude_keywords: dto.exclude_keywords.map((x) => x.trim()),
      updated_at: new Date().toISOString(),
    };
    const result = id
      ? await this.db.client
          .from("radar_profiles")
          .update(patch)
          .eq("id", id)
          .select("*")
          .maybeSingle()
      : await this.db.client
          .from("radar_profiles")
          .insert(patch)
          .select("*")
          .single();
    const row = this.check(result);
    if (!row) throw new NotFoundException("No encontramos ese perfil.");
    this.check(await this.db.client.rpc("radar_queue"));
    return row;
  }
  async queue() {
    return { queued: this.check(await this.db.client.rpc("radar_queue")) };
  }
  async status() {
    const [control, calls, total, alerts, cursors] = await Promise.all([
      this.db.client
        .from("radar_control")
        .select(
          "queued,lease_until,last_success_at,last_attempt_at,last_error,worker_seen_at,blocked_until",
        )
        .eq("id", 1)
        .single(),
      this.db.client
        .from("radar_requests")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      this.db.client
        .from("radar_opportunities")
        .select("id", { count: "exact", head: true }),
      this.db.client
        .from("radar_alerts")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      this.db.client
        .from("radar_cursors")
        .select("scope,completed_at,next_page,mode")
        .order("scope"),
    ]);
    this.check(calls);
    this.check(total);
    this.check(alerts);
    this.check(cursors);
    const row = this.check(control);
    if (!row) throw new ServiceUnavailableException("Falta inicializar Radar.");
    const email = emailConfiguration(this.config);
    return {
      configured: !!this.config.get("MERCADO_PUBLICO_TICKET"),
      emailConfigured: email.ready,
      emailEnabled: email.enabled,
      ...row,
      running:
        !!row.lease_until && new Date(row.lease_until).getTime() > Date.now(),
      lease_until: undefined,
      calls24h: calls.count ?? 0,
      opportunities: total.count ?? 0,
      unread: alerts.count ?? 0,
      cursors: cursors.data,
    };
  }
  async alerts() {
    return this.check(
      await this.db.client
        .from("radar_alerts")
        .select(
          "id,opportunity_id,kind,title,message,created_at,read_at,email_state",
        )
        .order("created_at", { ascending: false })
        .limit(100),
    );
  }
  async readAlert(actor: string, id: string) {
    this.check(
      await this.db.client
        .from("radar_alerts")
        .update({ read_at: new Date().toISOString(), read_by: actor })
        .eq("id", id),
    );
    return { ok: true };
  }
  async upload(
    actor: string,
    id: string,
    file:
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException("Elige un documento.");
    await this.detail(id);
    const head = file.buffer;
    const valid: Record<string, boolean> = {
      "application/pdf": head.subarray(0, 5).toString() === "%PDF-",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4,
      "image/png": head
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      "image/jpeg": head[0] === 255 && head[1] === 216 && head[2] === 255,
    };
    if (!valid[file.mimetype] || file.size > 10485760)
      throw new BadRequestException("Usa PDF, DOCX, PNG o JPG de hasta 10 MB.");
    const name =
      file.originalname.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 150) ||
      "Documento";
    const path = `${id}/${randomUUID()}`;
    this.check(
      await this.db.client.storage
        .from("radar-documents")
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        }),
    );
    const result = await this.db.client
      .from("radar_uploads")
      .insert({
        opportunity_id: id,
        name,
        path,
        content_type: file.mimetype,
        size: file.size,
        uploaded_by: actor,
      })
      .select("id,name,content_type,size,created_at")
      .single();
    if (result.error) {
      await this.db.client.storage.from("radar-documents").remove([path]);
      this.check(result);
    }
    return result.data;
  }
  async document(id: string, documentId: string) {
    const row = this.check(
      await this.db.client
        .from("radar_uploads")
        .select("path,name")
        .eq("id", documentId)
        .eq("opportunity_id", id)
        .maybeSingle(),
    );
    if (!row) throw new NotFoundException("No encontramos ese documento.");
    return this.check(
      await this.db.client.storage
        .from("radar-documents")
        .createSignedUrl(row.path, 60, { download: row.name }),
    );
  }
}
