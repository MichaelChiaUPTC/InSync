import { HttpErrorResponse } from '@angular/common/http';

// Mensaje legible para mostrar al usuario a partir de un error HTTP
export const mensajeError = (e: unknown, porDefecto: string) => {
  const r = e as HttpErrorResponse;
  if (r.status === 0) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
  if (r.status === 403) return 'Tu rol no permite esta operación.';
  return r.error?.mensaje ?? porDefecto;
};
