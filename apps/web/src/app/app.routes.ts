import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'carta',
    loadComponent: () =>
      import('./pages/carta/carta.component').then((m) => m.CartaComponent),
  },
  {
    path: 'reservas',
    loadComponent: () =>
      import('./pages/reservas/reservas.component').then(
        (m) => m.ReservasComponent,
      ),
  },
  {
    path: 'pedidos',
    loadComponent: () =>
      import('./pages/pedidos/pedidos.component').then(
        (m) => m.PedidosComponent,
      ),
  },
  {
    path: 'club',
    loadComponent: () =>
      import('./pages/club/club.component').then((m) => m.ClubComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found.component').then(
        (m) => m.NotFoundComponent,
      ),
  },
];
