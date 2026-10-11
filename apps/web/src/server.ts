import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
// allowedHosts: hosts permitidos para el render SSR. En producción, detrás
// de Nginx/Cloudflare, el Host será el dominio real. Para desarrollo y el
// origen tras el proxy incluimos localhost y el dominio del restaurante.
const ALLOWED_HOSTS = (
  process.env['SSR_ALLOWED_HOSTS'] ??
  'localhost,127.0.0.1,restaurantecostamar.cl,www.restaurantecostamar.cl'
)
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);
const commonEngine = new CommonEngine({ allowedHosts: ALLOWED_HOSTS });

// Archivos estáticos del navegador (sin servir index en '/').
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// SSR on-demand para todas las rutas.
app.use((req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;
  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) => res.send(html))
    .catch((err) => next(err));
});

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
