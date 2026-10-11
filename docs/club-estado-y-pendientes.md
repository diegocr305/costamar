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
