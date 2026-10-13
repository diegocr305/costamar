# Web pública: rediseño preparado para revisión local

## Auditoría y decisión visual

El inicio anterior tenía hero seguido directamente por ubicación/horarios/contacto.
Las fotos de platos estaban solamente en Carta. Faltaba un bloque propio del Club.
La carta ya consume `GET /api/v1/carta`, con categorías/productos disponibles e
imágenes WebP del bucket público media. No hace falta otro endpoint ni catálogo.

Problemas encontrados: hero original de 1,1 MB, navegación móvil cerrada que podía
recibir foco, canonical desactivado pese al dominio definitivo, cabecera pública
«Reservar» dirigida a WhatsApp y `/club` obsoleto con promesa de puntos y «pronto».
Las reseñas sin datos mostraban cinco estrellas decorativas; se sustituyeron por
una invitación a Google Maps para no sugerir una calificación sin datos.

Dirección elegida: superficies cálidas y claras para platos/formularios, marino
profundo para hero/Club/footer, detalles turquesa y botones naranja con texto oscuro.
Tokens compartidos en `apps/web/src/styles.css`; no modo oscuro global.

## Implementación

Home: hero → Descubre nuestros sabores → Club → experiencia → Visítanos → opiniones.
Hasta seis platos disponibles con foto, uno por categoría. Se priorizan categorías
existentes de ceviches, compartir, criollos, pescados, postres y pastas. La selección
es derivada de la API; no indica popularidad ni una recomendación comercial medida.
No muestra precios en portada: los precios reales permanecen en Carta.

Grid editorial en escritorio y desplazamiento horizontal táctil en móvil, sin
rotación automática ni scroll infinito. Cada foto enlaza a su categoría de Carta.
Hay estados de carga, error/reintento, ausencia de fotos y fallo de imagen.
Opiniones se carga al entrar en viewport; el enlace a Google existe en el placeholder.

Se reutiliza la fotografía real del hero, optimizada localmente a WebP: 262 KB a
1600 px y 108 KB a 800 px. Imagen principal con prioridad alta y dimensiones;
platos con lazy loading. No se encontraron fotografías verificadas del local en
los assets inspeccionados; Experiencia usa texto breve sin inventar imágenes.

La carta transfiere al navegador la respuesta obtenida por SSR, evitando una
segunda petición al arrancar. La información se consume una vez; no se crea una
cache persistente que pueda conservar precios antiguos. El tiempo máximo de la
selección de home es seis segundos; un fallo no bloquea hero, enlaces ni contacto.

Carta, Reservas, Pedidos y `/club` comparten los tokens y navegación. Reservas
conserva su lógica/contratos. Pedidos mantiene su estado de preparación y contacto
por WhatsApp. Google del Club, Admin, cupones, Radar, Supabase e inventario no cambian.

## Archivos principales

- `apps/web/src/app/pages/home/`: selección, secciones y composición responsive.
- `apps/web/src/assets/brand/home-hero*.webp`: versiones de la imagen existente.
- `apps/web/src/styles.css`: tokens, botones y foco compartidos.
- `apps/web/src/app/app.component.*`: navegación, reserva, footer y menú móvil.
- `apps/web/src/app/core/carta.service.ts`: transferencia de carta desde SSR.
- `apps/web/src/app/core/seo.service.ts`: canonical/OG y limpieza de JSON-LD al navegar.
- `apps/web/src/app/pages/carta/`: anclas, categorías y presentación.
- `apps/web/src/app/pages/reservas/reservas.component.css`: presentación del formulario.
- `apps/web/src/app/pages/club/club.component.ts`: enlace y comunicación vigentes.
- `apps/web/src/app/shared/`: presentación de Pedidos/opiniones y accesibilidad.

## Validación

Compilación Angular de producción/SSR correcta. SSR de home genera un H1, selección
real y datos de transferencia. Navegador con API pública real en 1440, 390 y 320 px:
seis platos, enlaces a categorías, imágenes de escritorio, ausencia de overflow,
menú móvil/Escape y recorridos Carta/Reservas/Pedidos/Club. Se revisaron capturas
de escritorio y móvil. No aparecieron errores de JavaScript en la comprobación.

Los tests locales permiten a las respuestas públicas el origen localhost en el
navegador; no cambian CORS de producción ni usan un catálogo inventado como fuente.
Casos controlados separados: carga pendiente, error HTTP, respuesta sin fotos y
imagen fallida. En todos permanece disponible «Ver carta completa». No se crearon
reservas ni se enviaron mensajes al probar la navegación.

Capturas privadas en `private-reports/web-redesign/`: before/after desktop y mobile,
small a 320 px, páginas interiores y resultados JSON. No se suben a Git.

## Revisión local y pendientes

Vista previa: `http://localhost:4400`. Para volver a levantarla después de compilar:

```powershell
pnpm --filter @costamar/web build
$env:PORT='4400'
node apps/web/dist/web/server/server.mjs
```

Preparado localmente; **no desplegado ni publicado automáticamente**. Pendientes:
aprobación visual, comprobar tacto en teléfono real, aportar fotografías del local
si se quieren añadir y medir rendimiento en producción tras un futuro despliegue.
No se ejecutó una certificación completa WCAG ni Lighthouse de producción.
La miniatura móvil del carrusel carga las demás fotografías cuando se recorren.
