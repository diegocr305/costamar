# Costa Mar — contexto para Tarea 8 (Angular SSR)

Fuente principal: https://menu.fu.do/costamarbarracevichera
Inspección de la página renderizada: 10 de octubre de 2026.

## Datos observados
- Marca: Costa Mar Barra Cevichera. Fudo muestra COSTAMAR.
- Dirección: Av. Rafael Ariztía 220, Local 1, Quillota, Chile.
- Teléfono y WhatsApp: +56 9 6283 8538.
- Correo: costamarbarracevichera@gmail.com
- Instagram: https://www.instagram.com/costamarbarracevichera/
- Facebook: https://www.facebook.com/Costamar (enlace configurado en Fudo; verificar que sea la cuenta deseada antes de publicar).
- WhatsApp: https://api.whatsapp.com/send?phone=56962838538
- Horario anunciado: lunes a jueves 12:00–19:00; viernes y sábado 12:00–22:00; domingo 12:00–19:00. Revisar vigencia antes del lanzamiento.
- Logo recuperado: costamar-logo.png. Es la imagen publicada en Fudo; tiene fondo blanco, no es un original vectorial.
- Logo fuente: https://fudo-apps-storage.s3.sa-east-1.amazonaws.com/production/251426/online-menu/logo
- Portada fuente: https://fudo-apps-storage.s3.sa-east-1.amazonaws.com/production/251426/online-menu/background-image
- Se observaron 181 tarjetas de producto. Algunos productos tienen “Sin Stock”; no convertir este estado temporal en disponibilidad permanente.

## Paleta basada en el logo
Colores sólidos medidos del raster: turquesa #12A7C2, agua #75BDC5, azul gris #6592A5 y dorado #E28E06. El aro azul y el nombre tienen degradados; no existe un único HEX para ellos.
Paleta web sugerida, pendiente de aprobación de marca:

| Token | HEX | Aplicación |
|---|---|---|
| primary | #12A7C2 | Detalles, identidad marina |
| primary-dark | #087C91 | Botones con texto blanco |
| secondary | #75BDC5 | Fondos suaves y detalles |
| gold | #E28E06 | Acentos; texto oscuro encima |
| ocean | #1263A0 | Encabezados y enlaces |
| background | #F5FBFC | Fondo general propuesto |
| surface | #FFFFFF | Tarjetas y fondo del logo |
| text | #17324D | Texto principal propuesto |

El HTML de Fudo usa naranja #FF5023, blanco #FFFFFF y texto #3D3D3D, con Barlow. Son estilos del menú actual; no son los colores principales del logo. Para la nueva web se propone Barlow con respaldo sans-serif.

```css
:root {
  --cm-primary: #12A7C2;
  --cm-primary-dark: #087C91;
  --cm-secondary: #75BDC5;
  --cm-gold: #E28E06;
  --cm-ocean: #1263A0;
  --cm-background: #F5FBFC;
  --cm-surface: #FFFFFF;
  --cm-text: #17324D;
}
```

## Texto editorial propuesto (no historia verificada)
Título: “Sabores del Perú en Quillota”.
Introducción: “Ceviches, cocina criolla y especialidades marinas para disfrutar y compartir. Descubre la carta de Costa Mar Barra Cevichera y encuentra tu próximo favorito.”
No inventar año de fundación, fundadores, premios ni origen de recetas. La historia real queda pendiente de información del propietario.

## Instrucción para la IA que implementa Tarea 8
Sí, avanza con la web pública Angular SSR usando este contexto.
1. Respetar arquitectura y versión de Angular ya existentes. Configurar SSR e hidratación. Evitar window/localStorage/document en código ejecutado por servidor.
2. Preparar interceptor HTTP para estados de error y mensajes útiles; no mostrar errores internos, no convertir un fallo de API en carta vacía silenciosa. Reintentar sólo lecturas con límite y conservar códigos de error. No añadir tokens privados al navegador ni al HTML SSR.
3. Inicio responsivo con logo real, fotografías importadas, presentación, CTA Ver carta y WhatsApp, ubicación, horarios y contacto. No generar imágenes sustitutas de platos que ya tienen foto.
4. SEO por ruta: título, descripción, canonical sólo cuando exista dominio definitivo, Open Graph con URL absoluta validada y JSON-LD Restaurant con datos reales. Sin ratings inventados.
5. Carta consumiendo nuestra API, con categorías/subcategorías, búsqueda, precios CLP enteros, imágenes, estados de carga/error y disponibilidad gestionada. Mantener rawName de Fudo y limpiar CARTA sólo en el nombre visible.
6. Scraper como comando independiente de importación; nunca ejecutarlo en cada petición SSR ni desde el navegador del cliente. Guardar JSON/CSV y fotos en almacenamiento propio. Revisar precios, stock y variantes antes de importar; DOM lista precios visibles, no todas las opciones o modificadores de la ficha.
7. Importación idempotente por source + sourceId; para IDs ausentes usar sourceUrl como clave estable. Reimportar sin duplicados. No borrar productos propios ni sobrescribir cambios locales sin una regla explícita. No importar automáticamente hasta revisar el resultado.
8. Reservas, pedidos y club: stubs responsivos con estado claro. No simular confirmaciones, pagos ni membresías exitosas sin backend conectado. Para contacto utilizar WhatsApp.
9. Verificar compilación SSR, acceso directo a rutas, hidratación, móvil, API caída y contraste. Publicar sólo después de completar datos pendientes y revisar el resultado.

## Pendientes antes de publicar
Dominio definitivo, historia real, políticas de reservas/pedidos/club, delivery y medios de pago; confirmar Facebook y horarios. Revisar alérgenos/ingredientes con el restaurante, no inferirlos automáticamente.
