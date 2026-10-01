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
  name: string;
  tenant: TenantId;
  apiUrl: string;
  theme: Tema;
}
