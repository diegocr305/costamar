/**
 * Importador idempotente de la carta a Supabase.
 *
 * Lee catalog.json (salida del scraper) y carga categorías y productos.
 * - Idempotente por (source, source_id): reimportar no duplica.
 * - El estado de stock de Fudo es temporal y NO se usa como disponibilidad;
 *   todos los productos se importan como disponibles (is_available = true).
 * - No borra productos propios ni sobrescribe cambios locales fuera de los
 *   campos provenientes de la fuente.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node import-carta.cjs ./export/catalog.json
 *
 * Si no se pasan por entorno, intenta leer apps/api/.env del repo.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

const SOURCE = 'fudo';

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
    // Node 20 no trae WebSocket nativo; proveemos 'ws' para el cliente.
    realtime: { transport: WebSocket },
  });

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const products = catalog.products.filter((p) => p.name && p.priceCLP != null);

  // 1) Categorías únicas, preservando el orden de aparición.
  const categoryNames = [];
  for (const p of products) {
    const cat = (p.category || 'Sin categoría').trim();
    if (!categoryNames.includes(cat)) categoryNames.push(cat);
  }

  const categoryIdByName = new Map();
  for (let i = 0; i < categoryNames.length; i++) {
    const name = categoryNames[i];
    // Buscar existente por nombre; si no, crear.
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      categoryIdByName.set(name, existing.id);
      await supabase.from('categories').update({ position: i }).eq('id', existing.id);
    } else {
      const { data: created, error } = await supabase
        .from('categories')
        .insert({ name, position: i, is_active: true })
        .select('id')
        .single();
      if (error) throw new Error(`Categoría "${name}": ${error.message}`);
      categoryIdByName.set(name, created.id);
    }
  }

  // 2) Productos (upsert idempotente por source + source_id).
  let inserted = 0;
  let updated = 0;
  let pos = 0;
  for (const p of products) {
    const categoryId = categoryIdByName.get((p.category || 'Sin categoría').trim());
    const row = {
      category_id: categoryId,
      name: p.name,
      description: p.description || null,
      base_price: p.priceCLP,
      is_available: true, // el stock de Fudo es temporal; se importa disponible
      position: pos++,
      source: SOURCE,
      source_id: p.sourceId || p.sourceUrl,
      source_url: p.sourceUrl || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('products')
      .select('id')
      .eq('source', SOURCE)
      .eq('source_id', row.source_id)
      .maybeSingle();

    if (existing) {
      await supabase.from('products').update(row).eq('id', existing.id);
      updated++;
    } else {
      const { error } = await supabase.from('products').insert(row);
      if (error) throw new Error(`Producto "${p.name}": ${error.message}`);
      inserted++;
    }
  }

  console.log(
    JSON.stringify({
      categories: categoryIdByName.size,
      productsInserted: inserted,
      productsUpdated: updated,
      total: products.length,
    }),
  );
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
