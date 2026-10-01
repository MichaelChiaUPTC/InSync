import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Store } from './store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(Store);
  const router = inject(Router);
  const token = store.sesion()?.accessToken;
  const esApi = req.url.startsWith(environment.apiUrl);
  const esLogin = req.url === `${environment.apiUrl}/login`;

  const peticion = token && esApi && !esLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status === 401 && esApi && !esLogin) {
        store.salir();
        store.avisar('Tu sesión venció. Entra de nuevo.', 'error');
        router.navigateByUrl('/login');
      }
      return throwError(() => e);
    }),
  );
};
