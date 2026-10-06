import { Routes } from '@angular/router';
import { accesoGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [accesoGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inventario' },
      {
        path: 'inventario',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin', 'erp_ventas', 'erp_inventario'] },
        loadChildren: () => import('./gestion-inventarios/gestion-inventarios.module').then((m) => m.GestionInventariosModule),
      },
      {
        path: 'ventas',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin', 'erp_ventas'] },
        loadChildren: () => import('./gestion-ventas/gestion-ventas.module').then((m) => m.GestionVentasModule),
      },
      {
        path: 'estadisticas',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin', 'erp_ventas'] },
        loadChildren: () => import('./estadisticas-ventas/estadisticas-ventas.module').then((m) => m.EstadisticasVentasModule),
      },
      {
        path: 'usuarios',
        canActivate: [accesoGuard],
        data: { roles: ['erp_admin'] },
        loadChildren: () => import('./gestion-usuarios/gestion-usuarios.module').then((m) => m.GestionUsuariosModule),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
