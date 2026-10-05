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

export interface LineaCarrito {
  productoId: string;
  cantidad: number;
}

// Forma que devuelve el backend
export interface VentaApi {
  id: string;
  usuario: string;
  fecha: string;
  total: number;
  metodo_pago: MetodoPago;
  lineas: { producto_id: string; nombre: string; cantidad: number; precio_unitario: number }[];
}
