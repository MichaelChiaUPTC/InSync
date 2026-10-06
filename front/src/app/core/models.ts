export type Rol = 'erp_admin' | 'erp_ventas' | 'erp_inventario';
export type TenantId = 'A' | 'B';

export const ROLES: { id: Rol; etiqueta: string; detalle: string }[] = [
  { id: 'erp_admin', etiqueta: 'Administrador', detalle: 'Acceso completo: usuarios, inventario y ventas' },
  { id: 'erp_ventas', etiqueta: 'Ventas', detalle: 'Registra ventas' },
  { id: 'erp_inventario', etiqueta: 'Inventario', detalle: 'Crea productos y ajusta precio y existencias' },
];

export interface Tenant {
  id: TenantId;
  nombre: string;
  actividad: string;
  puerto: number;
}

export interface Sesion {
  tenant: TenantId;
  apiUrl: string; // API de Serverless del negocio al que pertenece el usuario
  nombre: string;
  roles: Rol[];
  accessToken: string;
  refreshToken: string;
  expiraEn: number;
}

export type Resultado = { ok: true } | { ok: false; error: string };
