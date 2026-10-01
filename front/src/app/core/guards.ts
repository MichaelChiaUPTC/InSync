import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Rol } from './models';
import { Store } from './store';

export const accesoGuard: CanActivateFn = (route) => {
  const store = inject(Store);
  const router = inject(Router);
  if (!store.sesion()) return router.parseUrl('/login');
  const roles = route.data['roles'] as Rol[] | undefined;
  if (roles && !store.tieneRol(...roles)) {
    store.avisar('Tu rol no tiene acceso a esa sección.', 'error');
    return router.parseUrl('/inventario');
  }
  return true;
};
