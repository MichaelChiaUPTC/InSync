import { Entorno } from './entorno';

// Endpoints desplegados con Serverless (un prefijo por negocio: /tenantA y /tenantB).
// Para usar el backend local (serverless wsgi serve): 'http://localhost:5000'
const BASE = 'https://jkp4ha5lyd.execute-api.us-east-1.amazonaws.com/dev';

export const environment: Entorno = {
  production: false,
  apiUrls: {
    A: `${BASE}/tenantA`,
    B: `${BASE}/tenantB`,
  },
};
