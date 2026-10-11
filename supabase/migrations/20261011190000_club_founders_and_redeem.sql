-- ============================================================
-- Club Costa Mar: campaña fundadores (seed) + funciones
-- transaccionales de emisión y canje de cupones.
-- La API es la única autoridad; estas funciones son SECURITY DEFINER
-- y solo las ejecuta el backend (service_role).
-- ============================================================

-- Campaña de fundadores (en estado draft; se activa desde administración).
insert into public.club_campaigns (slug, name, description, type, status, max_coupons, rules)
values (
  'fundadores-50',
  'Primeros Socios Fundadores',
  'Beneficio de bienvenida para los primeros socios del Club Costa Mar.',
  'founders',
  'draft',
  60,
  '{"minAge": 18, "requiresCompleteProfile": true, "validityDays": 30}'::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  max_coupons = excluded.max_coupons,
  rules = excluded.rules,
  updated_at = now();

-- Emisión transaccional e idempotente del cupón de fundador.
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

  insert into public.club_coupons (code, campaign_id, user_id, status, expires_at)
  values (v_code, v_campaign.id, p_user_id, 'issued',
    now() + make_interval(days => coalesce((v_campaign.rules->>'validityDays')::int, 30)))
  returning * into v_new;

  insert into public.club_auth_events (user_id, event, meta)
  values (p_user_id, 'enroll', jsonb_build_object('founder_coupon', v_new.code));

  return v_new;
end;
$$;
revoke all on function public.issue_founder_coupon(uuid) from public, anon, authenticated;

-- Canje transaccional (evita doble canje concurrente).
create or replace function public.redeem_coupon(
  p_code text, p_staff_user_id uuid,
  p_products jsonb default '[]'::jsonb, p_consumption_ref text default null
)
returns public.club_coupon_redemptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.club_coupons;
  v_red public.club_coupon_redemptions;
begin
  select * into v_coupon from public.club_coupons where code = p_code for update;
  if not found then raise exception 'COUPON_NOT_FOUND'; end if;
  if v_coupon.status = 'redeemed' then raise exception 'ALREADY_REDEEMED'; end if;
  if v_coupon.status <> 'issued' then raise exception 'COUPON_NOT_REDEEMABLE'; end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    update public.club_coupons set status = 'expired' where id = v_coupon.id;
    raise exception 'COUPON_EXPIRED';
  end if;

  update public.club_coupons set status = 'redeemed', redeemed_at = now()
    where id = v_coupon.id;

  insert into public.club_coupon_redemptions
    (coupon_id, staff_user_id, member_user_id, products, consumption_ref)
  values (v_coupon.id, p_staff_user_id, v_coupon.user_id,
    coalesce(p_products, '[]'::jsonb), p_consumption_ref)
  returning * into v_red;

  return v_red;
end;
$$;
revoke all on function public.redeem_coupon(text, uuid, jsonb, text) from public, anon, authenticated;
