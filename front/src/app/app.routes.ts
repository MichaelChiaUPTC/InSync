import { Routes } from '@angular/router';
import { accesoGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./autenticacion/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [accesoGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inventario' },
      {
        path: 'inventario',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin', 'erp_ventas', 'erp_inventario'] },
        loadComponent: () => import('./gestion-inventarios/inventario').then((m) => m.Inventario),
      },
      {
        path: 'ventas',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin', 'erp_ventas'] },
        loadComponent: () => import('./gestion-ventas/ventas').then((m) => m.Ventas),
      },
      {
        path: 'usuarios',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin'] },
        loadComponent: () => import('./gestion-usuarios/usuarios').then((m) => m.Usuarios),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
