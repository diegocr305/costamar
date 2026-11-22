-- El envío de recordatorios ahora respeta el límite de Resend (2 por segundo), así que un lote
-- grande tarda más que los 5 s por defecto de pg_net. Se amplía el tiempo de espera a 60 s.
create or replace function public.club_dispatch_coupon_reminders()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_base text := public.club_edge_setting('edge_base_url');
  v_key  text := public.club_edge_setting('edge_cron_secret');
begin
  perform public.club_prepare_coupon_reminders(7);
  if v_base is not null and btrim(v_base) <> '' then
    perform net.http_post(
      url := rtrim(v_base, '/') || '/functions/v1/coupon-reminders',
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_key, '')),
      timeout_milliseconds := 60000);
  end if;
end;
$$;
revoke all on function public.club_dispatch_coupon_reminders() from public, anon, authenticated;
grant execute on function public.club_dispatch_coupon_reminders() to service_role;
