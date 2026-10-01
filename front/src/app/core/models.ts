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

export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  stock: number;
}

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia';
export const METODOS_PAGO: { id: MetodoPago; etiqueta: string }[] = [
  { id: 'efectivo', etiqueta: 'Efectivo' },
  { id: 'tarjeta', etiqueta: 'Tarjeta' },
  { id: 'transferencia', etiqueta: 'Transferencia' },
];

export interface LineaVenta {
  productoId: string;
  nombre: string;
  cantidad: number;
  precio: number;
}

export interface Venta {
  id: string;
  usuario: string;
  fecha: string;
  total: number;
  metodoPago: MetodoPago;
  detalle: LineaVenta[];
}

export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  email: string;
  roles: Rol[];
  activo: boolean;
}

export interface Sesion {
  tenant: TenantId;
  nombre: string;
  roles: Rol[];
  accessToken: string;
  refreshToken: string;
  expiraEn: number;
}

export type Resultado = { ok: true } | { ok: false; error: string };
