-- ============================================================
-- Regalo de Bienvenida (fundadores): contenido comercial + imagen,
-- y vigencia CONFIGURABLE (sin inventar fecha de expiración).
-- ============================================================

update public.club_campaigns set
  name = 'Regalo de Bienvenida — 50 Socios Fundadores',
  description = 'Eres parte de nuestros primeros 50 socios fundadores. Disfruta de 1 bebestible personal de regalo a elección entre jugo, bebida o schop de cerveza, con consumo en nuestro restaurante.',
  image_path = 'club/jugo.png',
  rules = '{"minAge": 18, "requiresCompleteProfile": true, "requiresConsumption": true, "benefit": "1 bebestible personal", "options": ["jugo individual", "bebida individual", "schop de cerveza individual"], "alcoholRequiresIdCheck": true, "conditions": ["Válido para una persona", "Requiere consumo asociado en el local", "Un solo canje por socio", "No acumulable con otras promociones salvo autorización", "Sujeto a disponibilidad", "No canjeable por dinero", "La opción con alcohol requiere mayoría de edad y validación presencial"], "validityDays": null, "expiryPending": true}'::jsonb,
  updated_at = now()
where slug = 'fundadores-50';

-- Emisión con vigencia configurable: si validityDays es null, el cupón
-- se emite SIN expiración (pendiente de definir); no se inventa fecha.
create or replace function public.issue_founder_coupon(p_user_id uuid)
returns public.club_coupons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.club_campaigns;
  v_existing public.club_coupons;
  v_count integer;
  v_code text;
  v_days int;
  v_expires timestamptz;
  v_new public.club_coupons;
begin
  select * into v_campaign from public.club_campaigns
    where slug = 'fundadores-50' for update;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if v_campaign.status <> 'active' then raise exception 'CAMPAIGN_NOT_ACTIVE'; end if;

  select * into v_existing from public.club_coupons
    where campaign_id = v_campaign.id and user_id = p_user_id limit 1;
  if found then return v_existing; end if;

  select count(*) into v_count from public.club_coupons where campaign_id = v_campaign.id;
  if v_campaign.max_coupons is not null and v_count >= v_campaign.max_coupons then
    raise exception 'NO_COUPONS_LEFT';
  end if;

  v_code := 'FND-' || upper(replace(substr(gen_random_uuid()::text, 1, 10), '-', ''));
  v_days := nullif(v_campaign.rules->>'validityDays', '')::int;
  v_expires := case when v_days is null then null else now() + make_interval(days => v_days) end;

  insert into public.club_coupons (code, campaign_id, user_id, status, expires_at)
  values (v_code, v_campaign.id, p_user_id, 'issued', v_expires)
  returning * into v_new;

  insert into public.club_auth_events (user_id, event, meta)
  values (p_user_id, 'enroll', jsonb_build_object('founder_coupon', v_new.code));

  return v_new;
end;
$$;
revoke all on function public.issue_founder_coupon(uuid) from public, anon, authenticated;
