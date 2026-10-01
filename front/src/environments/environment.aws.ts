import { Entorno } from './entorno';
import { temaA } from './temas';

export const environment: Entorno = {
  production: true,
  name: 'supermercado-el-ahorro',
  tenant: 'A',
  apiUrl: 'https://8ntilq8za1.execute-api.us-east-1.amazonaws.com/tenantA',
  theme: temaA,
};
