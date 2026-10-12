-- Beneficios automáticos: cumpleaños por año/mes de Chile y bienvenida.
-- Las funciones se ejecutan únicamente por backend, triggers o cron.
insert into public.club_campaigns (slug, name, description, type, status, rules)
values ('barco-cumpleanero', 'Barco Cumpleañero — Personal',
  'Celebra tu mes de cumpleaños con 1 bebestible y 1 postre personal de regalo, con consumo asociado en Costa Mar. Un beneficio por socio por año, válido hasta terminar tu mes de cumpleaños.',
  'birthday', 'active',
  '{"minAge":18,"requiresCompleteProfile":true,"requiresConsumption":true,"benefit":"1 bebestible + 1 postre personal","birthdayMonth":true,"onePerYear":true,"alcoholRequiresIdCheck":true}'::jsonb)
on conflict (slug) do nothing;

create or replace function public.issue_birthday_coupon(p_user_id uuid, p_at timestamptz default now())
returns public.club_coupons
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign public.club_campaigns;
  v_member public.club_members;
  v_coupon public.club_coupons;
  v_today date := (p_at at time zone 'America/Santiago')::date;
  v_period text := 'y-' || extract(year from v_today)::int;
  v_expiry timestamptz := (date_trunc('month', p_at at time zone 'America/Santiago') + interval '1 month') at time zone 'America/Santiago';
begin
  select * into v_campaign from public.club_campaigns where slug = 'barco-cumpleanero' for update;
  if not found or v_campaign.status <> 'active' then return null; end if;
  if (v_campaign.starts_at is not null and p_at < v_campaign.starts_at)
     or (v_campaign.ends_at is not null and p_at >= v_campaign.ends_at) then return null; end if;
  select * into v_member from public.club_members where user_id = p_user_id;
  if not found or v_member.status <> 'active' or nullif(btrim(v_member.full_name), '') is null
     or nullif(btrim(v_member.phone), '') is null or v_member.birth_date is null then return null; end if;
  if extract(year from age(v_today, v_member.birth_date)) < 18
     or extract(month from v_member.birth_date) <> extract(month from v_today) then return null; end if;

  select * into v_coupon from public.club_coupons
    where campaign_id = v_campaign.id and user_id = p_user_id and period_key = v_period;
  if found then return v_coupon; end if;
  if v_campaign.max_coupons is not null and
     (select count(*) from public.club_coupons where campaign_id = v_campaign.id and period_key = v_period) >= v_campaign.max_coupons then return null; end if;
  insert into public.club_coupons (code, campaign_id, user_id, period_key, issued_at, expires_at)
    values ('BDAY-' || upper(replace(gen_random_uuid()::text, '-', '')), v_campaign.id,
      p_user_id, v_period, p_at, v_expiry)
    returning * into v_coupon;
  insert into public.club_auth_events (user_id, event, meta)
    values (p_user_id, 'enroll', jsonb_build_object('benefit', 'birthday', 'coupon_id', v_coupon.id, 'period_key', v_period));
  return v_coupon;
end;
$$;
revoke all on function public.issue_birthday_coupon(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_birthday_coupon(uuid, timestamptz) to service_role;

create or replace function public.assign_club_benefits(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.club_members;
begin
  -- Siempre bloquear campaña antes de socio, igual que emisión y batch.
  perform 1 from public.club_campaigns where slug in ('barco-cumpleanero', 'fundadores-50') order by slug for update;
  select * into v_member from public.club_members where user_id = p_user_id;
  if not found or v_member.status <> 'active' or nullif(btrim(v_member.full_name), '') is null
     or nullif(btrim(v_member.phone), '') is null or v_member.birth_date is null
     or extract(year from age((now() at time zone 'America/Santiago')::date, v_member.birth_date)) < 18 then return; end if;
  perform public.issue_birthday_coupon(p_user_id);
  -- La bienvenida es idempotente y mantiene el tope actualmente configurado.
  begin
    perform public.issue_founder_coupon(p_user_id);
  exception when raise_exception then
    if sqlerrm not in ('CAMPAIGN_NOT_FOUND', 'CAMPAIGN_NOT_ACTIVE', 'NO_COUPONS_LEFT') then raise; end if;
  end;
end;
$$;
revoke all on function public.assign_club_benefits(uuid) from public, anon, authenticated;
grant execute on function public.assign_club_benefits(uuid) to service_role;

-- Se asignan al completar el perfil, incluso usando la versión actual de la API.
create or replace function public.club_assign_benefits_on_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assign_club_benefits(new.user_id);
  return new;
end;
$$;
revoke all on function public.club_assign_benefits_on_profile() from public, anon, authenticated;
drop trigger if exists club_assign_benefits_on_profile on public.club_members;
create trigger club_assign_benefits_on_profile after insert or update of full_name, phone, birth_date, status
  on public.club_members for each row execute function public.club_assign_benefits_on_profile();

-- Un cambio libre de cumpleaños no puede generar beneficios en otro mes.
create or replace function public.club_protect_benefit_birth_date()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date
     and exists (select 1 from public.club_coupons q join public.club_campaigns c on c.id = q.campaign_id
       where q.user_id = old.user_id and c.type = 'birthday') then
    raise exception 'BIRTH_DATE_LOCKED';
  end if;
  return new;
end;
$$;
revoke all on function public.club_protect_benefit_birth_date() from public, anon, authenticated;
drop trigger if exists club_protect_benefit_birth_date on public.club_members;
create trigger club_protect_benefit_birth_date before update of birth_date on public.club_members
  for each row execute function public.club_protect_benefit_birth_date();

create or replace function public.sync_club_birthday_benefits()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_before bigint;
  v_expired integer;
begin
  -- Serializa runs del cron y sincronizaciones simultáneas.
  perform 1 from public.club_campaigns where slug = 'barco-cumpleanero' for update;
  select count(*) into v_before from public.club_coupons q join public.club_campaigns c on c.id = q.campaign_id where c.slug = 'barco-cumpleanero';
  update public.club_coupons set status = 'expired'
    where status = 'issued' and expires_at is not null and expires_at <= now();
  get diagnostics v_expired = row_count;
  for v_user in select user_id from public.club_members
    where status = 'active' and birth_date is not null
      and extract(month from birth_date) = extract(month from now() at time zone 'America/Santiago')
    order by enrolled_at, user_id
  loop
    perform public.issue_birthday_coupon(v_user);
  end loop;
  return jsonb_build_object('expired', v_expired, 'issued',
    (select count(*) from public.club_coupons q join public.club_campaigns c on c.id = q.campaign_id where c.slug = 'barco-cumpleanero') - v_before);
end;
$$;
revoke all on function public.sync_club_birthday_benefits() from public, anon, authenticated;
grant execute on function public.sync_club_birthday_benefits() to service_role;

-- Cron usa fechas chilenas dentro de la función, independiente del UTC del servidor.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('costamar-birthday-benefits', '*/15 * * * *', 'select public.sync_club_birthday_benefits();');
