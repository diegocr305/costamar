-- ============================================================
-- Los despachos de cron (cupones por vencer y resumen diario de reservas) leían la URL y el
-- secreto de "app.settings.*" (ALTER DATABASE ... SET). En Supabase alojado ese rol no puede
-- fijar parámetros propios, y además el secreto quedaría en texto plano.
-- Ahora se leen de Supabase Vault (cifrado), con respaldo a app.settings.* para entornos locales.
--
-- Los VALORES no van en esta migración. Se cargan una vez en Vault:
--   select vault.create_secret('https://<ref>.supabase.co', 'edge_base_url');
--   select vault.create_secret('<mismo CRON_SECRET de la Edge Function>', 'edge_cron_secret');
-- ============================================================

create or replace function public.club_edge_setting(p_name text) returns text
language plpgsql stable security definer set search_path='' as $$
declare v text;
begin
 begin
  select decrypted_secret into v from vault.decrypted_secrets where name=p_name limit 1;
 exception when others then
  v:=null; -- Vault no disponible (p. ej. base local): se usa el respaldo.
 end;
 return coalesce(nullif(v,''),current_setting('app.settings.'||p_name,true));
end;$$;
revoke all on function public.club_edge_setting(text) from public,anon,authenticated;
grant execute on function public.club_edge_setting(text) to service_role;

create or replace function public.club_dispatch_coupon_reminders()
returns void language plpgsql security definer set search_path=''
as $$
declare
  v_base text:=public.club_edge_setting('edge_base_url');
  v_key  text:=public.club_edge_setting('edge_cron_secret');
begin
  -- Siempre deja la cola lista (WhatsApp + selección de email).
  perform public.club_prepare_coupon_reminders(7);
  -- Dispara el envío de emails solo si la Edge Function está configurada.
  if v_base is not null and btrim(v_base)<>'' then
    perform net.http_post(
      url:=rtrim(v_base,'/')||'/functions/v1/coupon-reminders',
      body:='{}'::jsonb,
      headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||coalesce(v_key,'')));
  end if;
end;$$;

create or replace function public.reservation_dispatch_digest() returns void
language plpgsql security definer set search_path='' as $$
declare
 v_base text:=public.club_edge_setting('edge_base_url');
 v_key text:=public.club_edge_setting('edge_cron_secret');
begin
 if extract(hour from (now() at time zone 'America/Santiago'))<>9 then return;end if;
 if v_base is null or btrim(v_base)='' then return;end if;
 perform net.http_post(
  url:=rtrim(v_base,'/')||'/functions/v1/reservations-digest',
  body:='{}'::jsonb,
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||coalesce(v_key,'')));
end;$$;
