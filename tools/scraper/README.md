# Scraper Costa Mar / Fudo

Requisitos: Node.js 20+ y terminal dentro de una carpeta del proyecto.

```bash
npm install --save-dev playwright
npx playwright install chromium
node scrape-fudo.cjs
```

En Windows funcionan estos comandos en PowerShell. Para elegir carpeta de salida:

```bash
node scrape-fudo.cjs ./costamar-export
```

Salidas: catalog.json, catalog.csv (UTF-8 con BOM) y assets/ con logo, portada y fotos. Las extensiones se determinan por Content-Type porque Fudo publica URLs sin extensión. Conserva enlaces fuente y fecha; no captura datos de clientes ni pedidos.

Se comprobó en la página real la estructura a.product, h4, .product__info p, .product-price__amounts y .badge--noStock; el navegador observó 181 productos. El script pasó comprobación sintáctica, pero la ejecución completa en este entorno no se realizó porque falta el ejecutable Chromium de Playwright. Instalarlo con el comando anterior y ejecutar antes de importar.

La extracción captura lo visible en la lista. No abre cada ficha ni garantiza variantes, modificadores, precios de opciones o stock en tiempo real. catalog.json incluye texto público de la página para revisar datos del restaurante. Revisar manualmente antes de cargar en la API propia.

Código de salida 2 significa que se guardó el catálogo pero falló alguna descarga; consultar downloadFailures. Código 1 significa error de extracción. No usa credenciales ni evita desafíos de acceso.

El logo incluido es el recurso raster servido por Fudo. Los colores identificados en COSTAMAR_WEB_CONTEXT.md se midieron de esa imagen; los tokens web adicionales son propuestas.

---

## Importación a Supabase (import-carta.cjs)

Tras ejecutar el scraper y revisar `export/catalog.json`, importar a la BD:

```bash
# Lee credenciales de apps/api/.env automáticamente
node import-carta.cjs ./export/catalog.json
```

Características:
- Idempotente por `(source, source_id)`: reimportar actualiza, no duplica.
- El estado de stock de Fudo es temporal: todos los productos se importan como
  `is_available = true`. Ajustar manualmente en el admin si algo está agotado.
- Crea/actualiza categorías por nombre, preservando el orden de aparición.

Última importación verificada: 12 categorías, 181 productos (precios $1.500–$57.990).
