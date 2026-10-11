# Club Costa Mar — Configuración de Google OAuth y Supabase Auth

Pasos manuales (una sola vez) para habilitar "Continuar con Google" en el Club.
No requieren tocar código. No incluyen secretos en el repositorio.

## Resumen de la arquitectura de auth

- La app **club** es una SPA/PWA (sin SSR). Usa `@supabase/supabase-js` con
  **flujo PKCE** y clave **publishable** (pública, segura con RLS).
- El login redirige a Google → Supabase → vuelve a
  `https://club.restaurantecostamar.cl/auth/callback`, donde la app
  intercambia el código por sesión.
- La API valida el JWT de Supabase vía **JWKS ES256**; la identidad del socio
  es `auth.users.id` (claim `sub`). Nunca se usa `service_role` en el frontend.

---

## 1. Google Cloud Console

1. Crear/usar un proyecto en https://console.cloud.google.com.
2. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo: Externo. Completar nombre de la app, correo de soporte y logo.
   - Dominios autorizados: `restaurantecostamar.cl`.
   - Publicar la app (o añadir testers mientras esté en modo prueba).
3. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo: Aplicación web.
   - **Orígenes autorizados de JavaScript**:
     - `https://pebdhasajkvsjttclbhf.supabase.co`
   - **URIs de redireccionamiento autorizados** (exacto):
     - `https://pebdhasajkvsjttclbhf.supabase.co/auth/v1/callback`
4. Guardar el **Client ID** y **Client Secret** (no van al repo).

---

## 2. Supabase — Authentication

1. Panel del proyecto → **Authentication → Providers → Google**:
   - Habilitar.
   - Pegar **Client ID** y **Client Secret** de Google.
   - Guardar.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://club.restaurantecostamar.cl`
   - **Redirect URLs** (añadir TODAS, exactas):
     - `https://club.restaurantecostamar.cl/auth/callback`
     - `https://club.restaurantecostamar.cl` (salvaguarda: la landing reenvía al callback)
     - `http://localhost:4202/auth/callback` (desarrollo local)
     - `http://localhost:4202` (desarrollo local)

   > IMPORTANTE: La **Site URL** del proyecto Supabase es compartida. Si el
   > admin o la web usan otra Site URL, NO la cambies por el club: en su lugar
   > asegúrate de que las Redirect URLs del club estén en la lista blanca.
   > Si una `redirectTo` solicitada no está en la lista, Supabase la ignora y
   > redirige a la Site URL por defecto (síntoma: vuelve a
   > `restaurantecostamar.cl/?code=...` en vez de al club).
3. (Opcional) **Authentication → Policies / Rate limits**: dejar los valores por
   defecto para el piloto.

> La clave **publishable** (`sb_publishable_...`) ya está en
> `apps/club/src/environments/*`. Es pública y segura con RLS activo.
> La clave **secret** (`sb_secret_...`) solo vive en el backend (`.env`),
> nunca en el club.

---

## 3. DNS y Nginx del subdominio club (cuando se despliegue)

- Cloudflare: registro `A` **Proxied** `club` → IP del servidor.
- Nginx: activar el vhost `nginx/club.restaurantecostamar.cl.conf`
  (proxy a `127.0.0.1:4002`, el contenedor del club). Ver `docs/deployment.md`
  para el procedimiento de instalación de vhosts.
- Añadir el servicio `club` al compose cuando se decida publicarlo.

---

## 4. Verificación

1. Entrar a `https://club.restaurantecostamar.cl/`.
2. "Continuar con Google" → autenticación → vuelve a `/auth/callback`.
3. Primer ingreso → `/completar-perfil` (nombre, teléfono, aceptar términos y
   privacidad; marketing opcional) → `/mi-tarjeta`.
4. Reingreso → directo a `/mi-tarjeta` (membresía recuperada, no se duplica).

## Seguridad verificada

- `redirectTo` se fija al origen propio en el código → sin open-redirect.
- La identidad en la API proviene del JWT (`sub`), nunca del body.
- Alta idempotente por `user_id` → sin registros duplicados.
- RLS: cada socio solo ve/edita sus filas; auditoría solo backend.
- El enroll jamás inserta en `user_roles` → no crea roles administrativos.
- El service worker no cachea respuestas de la API ni tokens.
