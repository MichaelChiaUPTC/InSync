import { Entorno } from './entorno';
import { temaA } from './temas';

export const environment: Entorno = {
  production: false,
  name: 'supermercado-el-ahorro',
  tenant: 'A',
  apiUrl: 'http://localhost:5000',
  theme: temaA,
};
