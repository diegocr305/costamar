import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import {
  provideClientHydration,
  withHttpTransferCacheOptions,
  withEventReplay,
} from '@angular/platform-browser';
import { appConfig } from './app.config';

/**
 * Config exclusiva del navegador: añade la hidratación del lado cliente.
 *
 * withHttpTransferCacheOptions: el servidor serializa las respuestas HTTP
 * del SSR y el cliente las REUTILIZA en la primera hidratación, evitando un
 * segundo fetch (que causaba el parpadeo a "error" en la carta).
 */
const clientConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        includePostRequests: false,
        includeRequestsWithAuthHeaders: false,
      }),
    ),
  ],
};

export const config = mergeApplicationConfig(appConfig, clientConfig);
