import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./pages/auth-callback/auth-callback.component').then(
        (m) => m.AuthCallbackComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'inventario',
        canActivate: [roleGuard(['superadmin', 'admin', 'inventory'])],
        loadComponent: () =>
          import('./pages/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent,
          ),
        data: { title: 'Inventario' },
      },
      {
        path: 'carta',
        canActivate: [roleGuard(['superadmin', 'admin', 'manager'])],
        loadComponent: () =>
          import('./features/carta/carta.component').then(
            (m) => m.CartaAdminComponent,
          ),
      },
      {
        path: 'pedidos',
        loadComponent: () =>
          import('./pages/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent,
          ),
        data: { title: 'Pedidos' },
      },
      {
        path: 'club/historial',
        canActivate: [roleGuard(['superadmin', 'admin', 'manager', 'cashier'])],
        loadComponent: () => import('./features/club/club-history.component').then(m => m.ClubHistoryComponent),
      },
      {
        path: 'club/validar',
        canActivate: [roleGuard(['superadmin', 'admin', 'manager', 'cashier'])],
        loadComponent: () =>
          import('./features/club/club-validar.component').then(
            (m) => m.ClubValidarComponent,
          ),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard(['superadmin', 'admin'])],
        loadComponent: () =>
          import('./pages/placeholder/placeholder.component').then(
            (m) => m.PlaceholderComponent,
          ),
        data: { title: 'Usuarios' },
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
