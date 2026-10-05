export interface Producto {
  id: string;
  codigo: string;
  nombre: string;
  precio: number;
  stock: number;
}

// Forma que devuelve el backend
export interface ProductoApi {
  id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  stock_actual: number;
}
