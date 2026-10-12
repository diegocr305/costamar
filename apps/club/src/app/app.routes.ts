import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { surveyGuard } from './core/survey.guard';

export const routes: Routes = [
  {path:'personalizar',canActivate:[authGuard],loadComponent:()=>import('./pages/personalizar/personalizar.component').then(m=>m.PersonalizarComponent)},
  // Landing pública del club (beneficios + continuar con Google)
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'ingresar',
    loadComponent: () =>
      import('./pages/ingresar/ingresar.component').then(
        (m) => m.IngresarComponent,
      ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./pages/auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
  },
  {
    path: 'completar-perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/completar-perfil/completar-perfil.component').then(
        (m) => m.CompletarPerfilComponent,
      ),
  },
  {
    path: 'mi-tarjeta',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/mi-tarjeta/mi-tarjeta.component').then(
        (m) => m.MiTarjetaComponent,
      ),
  },
  {
    path: 'cupones',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/cupones/cupones.component').then(
        (m) => m.CuponesComponent,
      ),
  },
  {
    path: 'inicio',
    canActivate: [authGuard, surveyGuard],
    loadComponent: () =>
      import('./pages/inicio/inicio.component').then((m) => m.InicioComponent),
  },
  {
    path: 'beneficios',
    loadComponent: () =>
      import('./pages/beneficios/beneficios.component').then(
        (m) => m.BeneficiosComponent,
      ),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/perfil/perfil.component').then((m) => m.PerfilComponent),
  },
  {
    path: 'ayuda',
    loadComponent: () =>
      import('./pages/ayuda/ayuda.component').then((m) => m.AyudaComponent),
  },
  { path: '**', redirectTo: '' },
];
