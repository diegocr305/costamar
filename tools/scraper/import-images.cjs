/**
 * Importador de imágenes de productos a Supabase Storage.
 *
 * Lee catalog.json (salida del scraper), descarga las imágenes de los
 * productos desde el storage de Fudo (detectando el formato por los bytes
 * mágicos, porque Fudo responde con content-type genérico octet-stream),
 * las sube al bucket "media" bajo:
 *     carta/products/{product_id}/{position}.{ext}
 * y registra cada una en la tabla public.product_images (idempotente).
 *
 * El logo/brand se sube a:  brand/logo.{ext}  y  brand/background.{ext}
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node import-images.cjs ./export/catalog.json
 *   (si no hay env, lee apps/api/.env)
 */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const SOURCE = 'fudo';
const BUCKET = 'media';
const FUDO_HOST = 'fudo-apps-storage.s3.sa-east-1.amazonaws.com';

function loadEnvFromApi() {
  const envPath = path.resolve(__dirname, '../../apps/api/.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Detecta el tipo de imagen por los primeros bytes (magic numbers). */
function sniffImage(buf) {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  // GIF: 47 49 46 38
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  // SVG (texto): empieza con "<?xml" o "<svg"
  const head = buf.slice(0, 64).toString('utf8').trimStart();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return { ext: 'svg', mime: 'image/svg+xml' };
  }
  return null;
}

async function fetchImage(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== FUDO_HOST) {
    throw new Error('Host de imagen inesperado');
  }
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const kind = sniffImage(buf);
  if (!kind) throw new Error('Formato de imagen no reconocido');
  return { buf, ...kind };
}

async function main() {
  const catalogPath = path.resolve(
    process.argv[2] || path.join(__dirname, 'export/catalog.json'),
  );
  if (!fs.existsSync(catalogPath)) {
    throw new Error(`No se encontró el catálogo: ${catalogPath}`);
  }

  const env = { ...loadEnvFromApi(), ...process.env };
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket },
  });

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  // --- 1) Logo / brand ---
  let brandDone = 0;
  for (const asset of catalog.brandAssets ?? []) {
    try {
      const { buf, ext, mime } = await fetchImage(asset.url);
      const role = asset.role === 'background' ? 'background' : 'logo';
      const storagePath = `brand/${role}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buf, { contentType: mime, upsert: true });
      if (error) throw new Error(error.message);
      brandDone++;
      console.log(`brand OK: ${storagePath}`);
    } catch (e) {
      console.warn(`brand FALLO (${asset.role}): ${e.message}`);
    }
  }

  // --- 2) Imágenes de productos ---
  // Mapa sourceId -> product.id (desde la BD, ya importados antes).
  const { data: dbProducts, error: dbErr } = await supabase
    .from('products')
    .select('id, source_id')
    .eq('source', SOURCE);
  if (dbErr) throw new Error(`Leyendo productos: ${dbErr.message}`);

  const idBySource = new Map();
  for (const p of dbProducts ?? []) idBySource.set(String(p.source_id), p.id);

  const withImages = catalog.products.filter((p) => p.imageUrl && p.sourceId);

  let uploaded = 0;
  let skipped = 0;
  const failures = [];

  for (const p of withImages) {
    const productId = idBySource.get(String(p.sourceId));
    if (!productId) {
      skipped++;
      continue;
    }

    try {
      const { buf, ext, mime } = await fetchImage(p.imageUrl);
      const position = 0;
      const storagePath = `carta/products/${productId}/${position}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buf, { contentType: mime, upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      // Registro idempotente en product_images (por product_id + position).
      const { data: existing } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', productId)
        .eq('position', position)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('product_images')
          .update({ storage_path: storagePath })
          .eq('id', existing.id);
      } else {
        const { error: insErr } = await supabase
          .from('product_images')
          .insert({ product_id: productId, storage_path: storagePath, position });
        if (insErr) throw new Error(`insert: ${insErr.message}`);
      }

      uploaded++;
      if (uploaded % 20 === 0) console.log(`... ${uploaded} imágenes subidas`);
    } catch (e) {
      failures.push({ name: p.name, url: p.imageUrl, error: e.message });
    }
  }

  console.log(
    JSON.stringify({
      brandUploaded: brandDone,
      productImagesUploaded: uploaded,
      productsWithoutMatch: skipped,
      failures: failures.length,
    }),
  );
  if (failures.length) {
    console.warn('Fallos:', JSON.stringify(failures.slice(0, 5), null, 2));
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
