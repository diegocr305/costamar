# Club Costa Mar — Estado y pendientes

Fecha: 2026-10-11
Repositorio: https://github.com/diegocr305/costamar (rama `main`)
Último commit relevante del club: `ecf4ecf`

## Estado actual (FUNCIONANDO en producción)

- URL en vivo: https://club.restaurantecostamar.cl
- Login con Google OAuth (Supabase Auth, flujo PKCE): **funciona**.
  - Flujo: landing → "Continuar con Google" → `/auth/callback` →
    `/completar-perfil` (primera vez) o `/mi-tarjeta` (socio existente).
- Infra lista: contenedor `costamar-club` (Nginx :4002) con healthcheck OK,
  vhost Nginx, DNS Cloudflare, CORS de la API para el origen del club.
- Base de datos: tablas `club_members`, `club_member_preferences`,
  `club_consents`, `club_auth_events` con RLS. Alta idempotente por `user_id`.
- API: `GET /club/me`, `POST /club/enroll`, `PATCH /club/preferences`,
  `GET /club/consents` (todas con JWT; identidad desde el token).

### Correcciones ya aplicadas (historial)
- Healthcheck del club: `127.0.0.1:4002` (evita fallo por IPv6 `::1`).
- OAuth: `exchangeCodeForSession` recibe SOLO el `code` (no la URL completa),
  lo que resolvía el 404 `flow_state_not_found`. Con test anti-regresión.
- Callback robusto: no expulsa a `/ingresar` si la sesión es válida pero
  `/club/me` falla temporalmente.
- Salvaguarda: si Supabase devuelve `?code=` a la raíz, la landing reenvía al
  callback.

## Pendientes para "terminar" el Club

### 1. Iconos de la PWA — HECHO ✅
Generados desde el logo con `tools/generate-club-icons.ps1`:
`icon-192.png`, `icon-512.png` (any), `icon-192-maskable.png`,
`icon-512-maskable.png` (maskable con safe zone) y `apple-touch-icon.png`
(iOS, 180x180). Manifest actualizado (any + maskable separados) y
`apple-touch-icon` añadido al `index.html`. Banner discreto de instalación
(`InstallPromptComponent`) que no bloquea el registro: botón nativo en
Android/Chrome e instrucciones en iOS, descartable.

Pendiente de validar en dispositivos reales:
- Android/Chrome: ver prompt de instalación y el icono correcto.
- iPhone/Safari: "Compartir → Agregar a inicio" usa apple-touch-icon.
- Escritorio: instalación desde la barra de direcciones.

### 2. Probar el alta end-to-end (completar-perfil → enroll)
Verificar en vivo que al enviar "Completa tu perfil":
- Se crea el socio (idempotente), se guardan consentimientos y preferencias.
- Redirige a `/mi-tarjeta` mostrando nombre, nivel y código de socio.
- Reingreso recupera la membresía (no duplica).

### 3. Tarjeta digital — QR real (fase futura)
Hoy hay un espacio reservado "QR disponible pronto", sin credencial de canje.
Pendiente: definir validación segura en el local antes de generar un QR real
(no exponer credenciales de canje inseguras).

### 4. Beneficios reales
La página `/beneficios` tiene texto genérico. Cuando el negocio defina los
beneficios/promos del club, cargarlos (idealmente desde datos, no hardcode).

### 5. Puntos y niveles de fidelización (fase posterior)
Los tipos existen en `shared/types/loyalty.ts` pero NO están implementados.
Pendiente: acreditación de puntos por consumo, canjes, y subida de nivel
(bronce/plata/oro). Requiere integrar con pedidos/consumo real.

### 6. Autenticación por teléfono (OTP) — fase posterior
Decisión de negocio: añadir login por teléfono verificado con OTP como segunda
opción. No iniciado.

### 7. Verificación de datos comerciales antes de publicar ampliamente
- Horarios del negocio (confirmar vigencia).
- Textos legales reales de términos y privacidad (hoy versión con fecha).

## Cómo actualizar el Club en el servidor (recordatorio)

```bash
cd costamar
git pull --ff-only
docker compose -f docker-compose.piloto.yml --env-file .env up -d --build club
docker inspect --format='{{.State.Health.Status}}' costamar-club   # healthy
```

El `.env` del servidor nunca se toca con git (está en `.gitignore`).

## Referencias
- Configuración OAuth: `docs/club-oauth-setup.md`
- Despliegue general: `docs/deployment.md`

---

## Cupones V1 — Fase 1 (en progreso)

Fecha: 2026-10-11

### Hecho (migraciones aplicadas en Supabase + versionadas en repo)
- `club_members`: añadidas `birth_date`, `phone_verified`, `phone_verified_at`
  (no destructivo).
- Nuevas tablas con RLS:
  - `club_campaigns` (campañas configurables, reglas en jsonb)
  - `club_campaign_products` (catálogo autorizado por campaña, reutiliza products)
  - `club_coupons` (unicidad campaña+usuario+periodo → sin doble emisión)
  - `club_coupon_redemptions` (un canje por cupón → sin doble canje)
  - `club_phone_verifications` (OTP, backend-only)
- RLS: socio ve solo sus cupones; campañas activas públicas; canjes/OTP solo backend.
- Migraciones: `20261011164000_*.sql` y `20261011164100_*.sql`.
- Favicon del club generado desde el logo oficial.

### Fase 1 — código HECHO (sin desplegar, pendiente de tu aprobación)
- Tipos compartidos: `types/coupons.ts` + `validation/age.validation.ts`
  (edad, cumpleaños TZ America/Santiago, 29‑feb, periodo anual).
- `ClubEnrollRequest`/`ClubMember`: `phone` y `birthDate` obligatorios;
  `phoneVerified` preparado (OTP diferido).
- API: `enroll` valida ≥18 (backend, TZ Chile), normaliza teléfono, guarda
  `birth_date` y PRESERVA `enrolled_at` (antigüedad). Nuevos endpoints de solo
  lectura: `GET /club/campaigns`, `GET /club/coupons`.
- PWA: completar-perfil ahora exige teléfono y fecha de nacimiento, con
  validación de edad en frontend.
- Tests: 36 pasando (edad/mayoría, 29‑feb, fuera de mes, periodo anual, menor
  de edad y fecha inválida en enroll).
- OTP: tabla NO creada (diferida). `phone_verified` queda en false.
- Reporte de conciliación de fundadores: `docs/club-fundadores-conciliacion.md`
  (NO se emitieron cupones).

### Fase 1 — PWA COMPLETA
- Pantalla de Cupones (/cupones) con 4 pestañas: disponibles, próximos,
  canjeados, vencidos. Solo lectura.
- Sección Inicio (/inicio) con campañas activas y saludo.
- Navegación inferior de 4 secciones (Inicio/Cupones/Mi tarjeta/Perfil),
  oculta en landing/ingresar/callback/completar-perfil.
- QR real en Mi tarjeta: codifica el member_code (público, sin datos
  sensibles ni credencial de canje). Librería `qrcode`.
- Favicon + iconos PWA (any/maskable/apple-touch) desde el logo oficial.
- Script de despliegue: `deploy.sh` (pull seguro + rebuild + verificación).

### Fundadores (50) — dónde y cuándo se activan
- Están en la MISMA base Supabase (tablas club_campaigns/club_coupons), NO en
  otra BD. Hoy NO hay cupones emitidos ni campaña activa.
- Se activarán en Fase 2 cuando: (1) los socios completen fecha de nacimiento,
  (2) se apruebe el reporte de conciliación, (3) se implemente la emisión
  transaccional con tope 50. Ver docs/club-fundadores-conciliacion.md.

### DECISIONES PENDIENTES (bloquean Fase 2/3, no Fase 1)
1. **OTP de teléfono**: proveedor (Twilio/WhatsApp) y presupuesto. Hoy
   `phone_verified` queda en false; la elegibilidad a promos limitadas se
   activará cuando haya OTP real.
2. **Fundadores (50)**: no hay fecha histórica confiable de "inscripción
   completada". Propuesta: usar `enrolled_at` como proxy de prioridad.
   NO emitir cupones reales hasta aprobar esta regla de conciliación.
3. **Paneles (personal + admin)**: reutilizar la app `admin` existente
   (ya tiene login y roles cashier/manager). Pendiente de confirmar.

### Importante
- No se han emitido cupones reales ni creado campañas activas.
- No se tocó Nginx, Docker ni la API en producción.
- Nada de cupones se ha pusheado aún (pendiente de tu aprobación para commit/push).
