import {
  bootstrapApplication,
  type BootstrapContext,
} from '@angular/platform-browser';
import { config } from './app/app.config.server';
import { AppComponent } from './app/app.component';

/**
 * Bootstrap del servidor (Angular 20): recibe el BootstrapContext que el
 * motor SSR provee y lo pasa a bootstrapApplication. Sin este contexto,
 * Angular lanza NG0401 (Missing Platform).
 */
const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(AppComponent, config, context);

export default bootstrap;
