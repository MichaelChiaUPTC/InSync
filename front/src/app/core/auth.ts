import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ROLES, Rol, Sesion, TenantId } from './models';

interface RespuestaLogin {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  tenant_id: TenantId;
}

const ROLES_VALIDOS = ROLES.map((r) => r.id);

// Solo para mostrar nombre y habilitar menús; la validación real la hace el backend con Keycloak.
const leerToken = (token: string): Record<string, unknown> => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
};

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);

  // Cada negocio tiene su propia API de Serverless: se prueba el login en cada una
  // y la que reconoce al usuario define su negocio y la API que usara despues.
  login(username: string, password: string): Observable<Sesion> {
    const urls = [...new Set(Object.values(environment.apiUrls))];

    const intentar = (i: number, fallo: HttpErrorResponse | null): Observable<Sesion> =>
      this.http.post<RespuestaLogin>(`${urls[i]}/login`, { username, password }).pipe(
        map((r) => aSesion(r, urls[i], username)),
        catchError((e: HttpErrorResponse) => {
          // Si alguna API no respondio, ese error pesa mas que un 401 de la otra
          const peor = e.status !== 401 ? e : (fallo ?? e);
          return i + 1 < urls.length ? intentar(i + 1, peor) : throwError(() => new Error(mensajeError(peor)));
        }),
      );

    return intentar(0, null);
  }
}

const aSesion = (r: RespuestaLogin, apiUrl: string, username: string): Sesion => {
  const claims = leerToken(r.access_token);
  const delRealm = (claims['realm_access'] as { roles?: string[] } | undefined)?.roles ?? [];
  const porClient = Object.values(
    (claims['resource_access'] as Record<string, { roles?: string[] }> | undefined) ?? {},
  ).flatMap((c) => c.roles ?? []);
  const roles = [...new Set([...delRealm, ...porClient])].filter((x): x is Rol => ROLES_VALIDOS.includes(x as Rol));
  const nombre = (claims['name'] as string) || (claims['preferred_username'] as string) || username;
  return {
    tenant: r.tenant_id,
    apiUrl,
    nombre,
    roles,
    accessToken: r.access_token,
    refreshToken: r.refresh_token,
    expiraEn: Date.now() + r.expires_in * 1000,
  };
};

const mensajeError = (e: HttpErrorResponse) => {
  if (e.status === 401) return 'Usuario o contraseña incorrectos.';
  if (e.status === 0) return 'No se pudo conectar con el servidor. Intenta de nuevo en unos minutos.';
  return 'No pudimos iniciar tu sesión. Intenta de nuevo.';
};
