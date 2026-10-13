-- Ejecutar después de las migraciones Radar, preferentemente en BD desechable.
begin;
do $$ begin
 if has_table_privilege('anon','public.radar_opportunities_deadlines','select')
  or has_table_privilege('authenticated','public.radar_opportunities_deadlines','select') then raise exception 'Vista expuesta'; end if;
 if not has_table_privilege('service_role','public.radar_opportunities_deadlines','select') then raise exception 'Backend sin acceso'; end if;
 if has_function_privilege('anon','public.radar_chile_deadline(text)','execute')
  or has_function_privilege('authenticated','public.radar_chile_deadline(text)','execute') then raise exception 'Función expuesta'; end if;
 if public.radar_chile_deadline('2026-07-13 10:00') <> '2026-07-13T14:00:00Z'::timestamptz then raise exception 'Invierno incorrecto'; end if;
 if public.radar_chile_deadline('2026-10-13T10:00:35.123') <> '2026-10-13T13:00:35.123Z'::timestamptz then raise exception 'Verano/segundos incorrectos'; end if;
 if public.radar_chile_deadline('2026-04-04 23:30') is not null
  or public.radar_chile_deadline('2026-09-06 00:30') is not null then raise exception 'DST ambiguo'; end if;
 if public.radar_chile_deadline('2026-02-30 10:00') is not null
  or public.radar_chile_deadline('2026-10-13 24:00') is not null
  or public.radar_chile_deadline('inválida') is not null then raise exception 'Fecha inválida aceptada'; end if;
end $$;
rollback;
