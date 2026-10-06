import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Resultado } from '../core/models';
import { Store } from '../core/store';
import { mensajeError } from '../shared/http-error';
import { Producto, ProductoApi } from './Interfaces/producto.interface';

const aProducto = (p: ProductoApi): Producto => ({
  id: p.id,
  codigo: p.sku,
  nombre: p.nombre,
  precio: p.precio_venta,
  stock: p.stock_actual,
});

@Injectable({ providedIn: 'root' })
export class GestionInventariosService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private get url() { return `${this.store.apiUrl()}/productos`; }

  async cargarProductos() {
    try {
      const lista = await firstValueFrom(this.http.get<ProductoApi[]>(this.url));
      this.store.productos.set(lista.map(aProducto));
    } catch (e) {
      this.store.avisar(mensajeError(e, 'No se pudieron cargar los productos.'), 'error');
    }
  }

  async crearProducto(p: Omit<Producto, 'id'>): Promise<Resultado> {
    try {
      const nuevo = await firstValueFrom(
        this.http.post<ProductoApi>(this.url, {
          sku: p.codigo,
          nombre: p.nombre,
          precio_venta: p.precio,
          stock_actual: p.stock,
        }),
      );
      this.store.productos.update((l) => [...l, aProducto(nuevo)]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo crear el producto.') };
    }
  }

  async actualizarProducto(id: string, precio: number, stock: number): Promise<Resultado> {
    try {
      const p = await firstValueFrom(
        this.http.put<ProductoApi>(`${this.url}/${id}`, { precio_venta: precio, stock_actual: stock }),
      );
      this.store.productos.update((l) => l.map((x) => (x.id === id ? aProducto(p) : x)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo actualizar el producto.') };
    }
  }

  async eliminarProducto(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/${id}`));
      this.store.productos.update((l) => l.filter((x) => x.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo eliminar el producto.') };
    }
  }
}
