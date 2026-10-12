# Pendientes, reglas de negocio y decisiones

> Encuesta de bienvenida implementada: `docs/club-encuesta-bienvenida.md`.
> Tras registro y al próximo ingreso a Inicio de socios sin encuesta. Opcional,
> omisión visible, estado/fechas en admin, no repetición y preferencias editables.
> Incluye “Aún no he visitado Costa Mar”. No condiciona regalos ni consentimientos.

> Equipo y accesos y preferencias opcionales implementados: ver
> `docs/club-equipo-preferencias.md`. Solo superadmin gestiona meseros (cashier).
> Roles vigentes comprobados en BD por petición; contactos promocionales por
> consentimiento de canal. Socios y filtros listos; envío de promociones y
> clasificación por frecuencia/inactividad pendientes de integraciones reales.

> Actualización 12-10-2026: leer `docs/club-lanzamiento-2026-10-12.md` primero.
> Admin ya accesible; healthcheck y Compose corregidos. Cumpleaños automático
> ya activado en Supabase (dos cupones de octubre + cron). Nueva portada,
> beneficios e ingreso directo a Google preparados; pendiente desplegar API/Club.
> La lista inferior conserva el contexto histórico; el punto de cumpleaños y
> protección de fecha de nacimiento ya está implementado.
> También se implementó el historial de canjes en `/club/historial`, se renovó
> la interfaz del admin y se asignó rol cashier a la cuenta del restaurante.
> Desplegar `api club admin` para publicar todo este cambio.
> Gestión de campañas implementada: ver `docs/club-campanas-admin.md`.
> Crear/editar, catálogo, cupos, vigencia, resultados y cupones paginados listos.
> Reservas es el siguiente módulo. Cumpleaños sigue sin límite de socios.
> Orden de atención acordado: mesa obligatoria; pedido/boleta/observación
> opcionales. Ya implementados campos separados, folio de canje y últimos seis
> canjes de hoy debajo del escáner, con filtro exacto por mesa.
> Ver `docs/club-orden-canjes.md`. Supabase actualizado; desplegar `api admin`.

## Estado actual (qué funciona)
- Web pública en vivo (hero con foto de ceviche, carta real con fotos, favicon).
- Club en vivo: login Google, perfil (nombre/teléfono/fecha nac. ≥18), tarjeta
  con QR real (member_code), Inicio, Cupones (4 pestañas), navegación inferior,
  tema oscuro, PWA instalable.
- API: endpoints de carta, club socio y club staff. 36 tests.
- Campaña fundadores (`fundadores-50`) **active**, 60 cupos, emisión y canje
  transaccionales funcionando (verificado end-to-end).
- Panel garzón (`/club/validar` en admin): validar/canjear por QR o código manual.
  Admin aún NO desplegado.

## Reglas de negocio CONFIRMADAS

### Regalo de Bienvenida — 50 Socios Fundadores (campaña `fundadores-50`)
- Premio: 1 **bebestible personal** a elección entre jugo / bebida / schop de cerveza.
- Para una sola persona, con **consumo asociado** en el local.
- NO es jarra, NO es para compartir, NO ilimitado.
- Alcohol (schop) solo mayores de 18 con verificación presencial; el personal
  puede negar alcohol según normas.
- Un solo canje por socio. No acumulable. No canjeable por dinero.
- Máximo 50 socios elegibles (hoy la BD tiene max_coupons=60 para incluir pruebas;
  **ajustar a 50 antes del lanzamiento real**).
- Inicio comercial: 11 de octubre de 2026.
- Imagen: `media/club/jugo.png` (ilustrativa; el premio es personal).
- Mostrar claramente "1 BEBESTIBLE PERSONAL DE REGALO".

### Barco Cumpleañero — Personal (campaña type `birthday`) — NO IMPLEMENTADO
- Premio: 1 bebestible + 1 postre personal (con/sin alcohol según catálogo).
- Consumo asociado obligatorio.
- Solo socios con perfil completo y ≥18.
- Activo automáticamente durante el **mes calendario** del cumpleaños (TZ America/Santiago).
- 1 cupón y 1 canje por socio por año.
- Vence al terminar el mes. 29-feb cuenta como febrero.
- No depende de que el socio abra la app. Si se inscribe en su mes, puede recibirlo.
- Año siguiente: nuevo cupón. Usar `period_key = y-{año}` para unicidad anual.
- Helpers ya listos en `packages/shared/src/validation/age.validation.ts`:
  `isAdult`, `isBirthdayMonth`, `birthdayPeriodKey`, `ageOn` (todos TZ Santiago, cubren 29-feb).

## DECISIONES PENDIENTES DEL DUEÑO (no inventar)
1. **Vigencia de cupones de fundadores**: `rules.validityDays = null` → hoy se
   emiten SIN expiración. Definir días o fecha límite.
2. **max_coupons fundadores**: hoy 60 (para pruebas). ¿Dejar en 50 para el real?
3. **Conciliación de socios**: hay cuentas de prueba/internas que no deben gastar
   cupos. Ver `docs/club-fundadores-conciliacion.md`. Socios actuales:
   - CM-RBVR70 DIEGO CABRERA, CM-U99OW2 Diego Alonso Cabrera Rios,
     CM-Q77UBE DIEGO ALONSO CABRERA RIOS (3 cuentas del dueño/pruebas),
     CM-Z0L7TN Costa Mar (marca), CM-SK6B3B Naysha Amones.
   - Decidir cuáles excluir antes de abrir al público.
4. **Reservas**: aforo/mesas, horarios, duración, anticipación mínima, política de
   cancelación, confirmación automática o manual. Ver `03-panel-admin-spec.md`.
5. **Productos permitidos** de cada campaña: cargar en `club_campaign_products`
   (jugo/bebida/schop para fundadores; bebestible+postre para cumpleaños).
6. **Horarios del negocio**: verificar vigencia (hoy en `packages/shared/.../business.ts`).

## PENDIENTES TÉCNICOS (orden sugerido)
1. **Desplegar admin** a producción → `04-despliegue-admin.md`. (Prioridad: habilita QR con HTTPS.)
2. **Módulo Campañas admin** (API `/club/admin/*` + vistas) → `03-panel-admin-spec.md`.
3. **Módulo Reservas** (migración + API + vistas admin + form en web) → `03-panel-admin-spec.md`.
4. **Cumpleaños automático**: endpoint que, al consultar cupones del socio,
   emita (idempotente, period_key anual) el cupón de cumpleaños si está en su mes
   y cumple requisitos; y marque expired los de meses pasados. Crear función RPC
   `issue_birthday_coupon` análoga a `issue_founder_coupon`.
5. **Reportes básicos** por campaña.
6. **Cargar club_campaign_products** del regalo y cumpleaños.
7. **Protección cambio de fecha de nacimiento**: hoy el enroll permite actualizarla.
   Añadir política: una vez verificada/usada para un beneficio, el cambio requiere
   acción administrativa auditada (no self-service libre).
8. **Inventario**: fase posterior.
9. **OTP de teléfono**: diferido. `phone_verified` queda en false. Preparar sin implementar.

## Fixes históricos ya resueltos (no reintroducir)
- Nginx 1.24 NO soporta `http2 on;` → eliminado de todos los vhosts.
- SSR_ALLOWED_HOSTS debe incluir `127.0.0.1`.
- OAuth PKCE: pasar SOLO el `code` a `exchangeCodeForSession` (no la URL).
- Emisión de cupones: usar `gen_random_uuid()` (pgcrypto `gen_random_bytes` no está).
- Healthcheck de contenedores nginx: usar `127.0.0.1`, no `localhost` (IPv6).
- Admin Dockerfile aún tiene el bug de healthcheck con localhost → corregir al desplegar.

## Seguridad (checklist permanente)
- `service_role` solo en API. Publishable key en front. `.env` gitignored.
- RLS activo; socio ve solo lo suyo; staff/mutaciones solo backend.
- QR del socio = member_code (público), NO autoriza canje por sí solo; el canje
  se valida y registra en backend con rol autorizado.
- No guardar fotos de documentos de identidad.
- Cámara QR requiere HTTPS (por eso el admin debe ir por dominio con SSL).
