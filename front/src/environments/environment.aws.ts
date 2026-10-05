import { Entorno } from './entorno';

const BASE = 'https://jkp4ha5lyd.execute-api.us-east-1.amazonaws.com/dev';

export const environment: Entorno = {
  production: true,
  apiUrls: {
    A: `${BASE}/tenantA`,
    B: `${BASE}/tenantB`,
  },
};
