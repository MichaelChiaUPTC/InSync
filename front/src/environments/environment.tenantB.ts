import { Entorno } from './entorno';
import { temaB } from './temas';

export const environment: Entorno = {
  production: false,
  name: 'pasteleria-dulce-aroma',
  tenant: 'B',
  apiUrl: 'http://localhost:5001',
  theme: temaB,
};
