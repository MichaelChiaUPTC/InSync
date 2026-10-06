import { TenantId } from '../app/core/models';

export interface Tema {
  primaryColor: string;
  primaryTextColor: string;
  deepColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  mutedColor: string;
  mutedForegroundColor: string;
  borderColor: string;
  logo: string;
}

export interface Entorno {
  production: boolean;
  // Base de la API de cada negocio: <url>/tenantA y <url>/tenantB
  apiUrls: Record<TenantId, string>;
}
