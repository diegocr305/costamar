const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const URL = 'https://menu.fu.do/costamarbarracevichera';
const out = path.resolve(process.argv[2] || 'costamar-export');
async function main() {
  await fs.mkdir(path.join(out, 'assets'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let data;
  try {
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('a.product').first().waitFor({ timeout: 60000 });
    // Wait for DOM product count to settle, with a bounded timeout.
    let previous = 0, stable = 0;
    for (let i = 0; i < 20 && stable < 3; i++) {
      const count = await page.locator('a.product').count();
      stable = count === previous ? stable + 1 : 0; previous = count;
      await page.waitForTimeout(500);
    }
    data = await page.evaluate(() => {
      const products = []; let category = null, subcategory = null;
      for (const el of document.querySelectorAll('h3,h4,a.product')) {
        if (el.matches('a.product')) {
          const rawName = el.querySelector('h4')?.textContent?.trim();
          const amounts = Array.from(el.querySelectorAll('.product-price__amounts span')).map(x=>x.textContent.trim());
          const priceText = amounts.at(-1) || null;
          const sourceUrl = el.href;
          const image = el.querySelector('img');
          const imageUrl = image?.getAttribute('src') ? new window.URL(image.getAttribute('src'), location.href).href : null;
          products.push({sourceId:sourceUrl.match(/-(\d+)$/)?.[1] || null, sourceUrl, category, subcategory,
            rawName, name:rawName?.replace(/\s+CARTA\s*$/i,'').trim(),
            description:el.querySelector('.product__info p')?.textContent?.trim() || '',
            priceText, priceCLP:priceText && /^\$\s*[\d.]+$/.test(priceText) ? Number(priceText.replace(/\D/g,'')) : null,
            priceAmounts:amounts, currency:'CLP',
            stockObserved:el.querySelector('.badge--noStock') ? 'out_of_stock' : 'not_marked_out_of_stock',
            imageUrl:imageUrl?.includes('product-default') ? null : imageUrl});
        } else if (!el.closest('a.product')) {
          if(el.tagName === 'H3'){category=el.textContent.trim();subcategory=null;}
          else subcategory=el.textContent.trim();
        }
      }
      const links = Array.from(document.querySelectorAll('a')).filter(x=>/^(mailto:|tel:)|instagram\.com|facebook\.com|api\.whatsapp\.com/.test(x.href)).map(x=>({text:x.textContent.trim(),url:x.href}));
      const brandAssets = Array.from(document.images).filter(x=>['Logo','Background'].includes(x.alt)).map(x=>({role:x.alt.toLowerCase(),url:x.src}));
      return {source:location.href,scrapedAt:new Date().toISOString(),products,brandAssets,links,visibleText:document.body.innerText};
    });
  } finally { await browser.close(); }
  if (!data.products.length || data.products.some(x=>!x.name)) throw new Error('Invalid extraction; check Fudo selectors.');
  const failures=[]; const cache=new Map();
  async function download(url) {
    if(cache.has(url)) return cache.get(url);
    const parsed=new global.URL(url);
    if(parsed.protocol!=='https:' || parsed.hostname!=='fudo-apps-storage.s3.sa-east-1.amazonaws.com') throw new Error('Unexpected asset host');
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const type=response.headers.get('content-type') || '';
    const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/svg+xml':'svg'})[type.split(';')[0]];
    if(!ext) throw new Error(`Unsupported image type: ${type}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    const relative=`assets/${crypto.createHash('sha256').update(url).digest('hex').slice(0,20)}.${ext}`;
    await fs.writeFile(path.join(out,relative),bytes); cache.set(url,relative); return relative;
  }
  // Sequential downloads keep load on the source low. Failures remain in manifest.
  for(const asset of [...data.brandAssets,...data.products.filter(x=>x.imageUrl)]){
    const url=asset.url || asset.imageUrl;
    try{asset.localPath=await download(url);}catch(e){failures.push({url,error:e.message});}
  }
  data.downloadFailures=failures;
  await fs.writeFile(path.join(out,'catalog.json'),JSON.stringify(data,null,2));
  const csvCell=x=>'"'+String(x??'').replaceAll('"','""')+'"';
  const fields=['sourceId','category','subcategory','name','description','priceCLP','currency','stockObserved','imageUrl','localPath','sourceUrl'];
  await fs.writeFile(path.join(out,'catalog.csv'),'\uFEFF'+[fields,...data.products.map(x=>fields.map(k=>x[k]))].map(row=>row.map(csvCell).join(',')).join('\r\n'));
  console.log(JSON.stringify({output:out,products:data.products.length,downloaded:cache.size,failures:failures.length}));
  if(failures.length) process.exitCode=2;
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
