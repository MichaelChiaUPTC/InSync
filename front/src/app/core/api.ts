import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MetodoPago, Producto, Resultado, Rol, Usuario, Venta } from './models';
import { Store } from './store';

interface ProductoApi {
  id: string;
  sku: string;
  nombre: string;
  precio_venta: number;
  stock_actual: number;
}

interface VentaApi {
  id: string;
  usuario: string;
  fecha: string;
  total: number;
  metodo_pago: MetodoPago;
  lineas: { producto_id: string; nombre: string; cantidad: number; precio_unitario: number }[];
}

interface UsuarioApi {
  id: string;
  username: string;
  email: string;
  nombre: string;
  roles: Rol[];
  activo: boolean;
}

const aProducto = (p: ProductoApi): Producto => ({
  id: p.id,
  codigo: p.sku,
  nombre: p.nombre,
  precio: p.precio_venta,
  stock: p.stock_actual,
});

const aUsuario = (u: UsuarioApi): Usuario => ({
  id: u.id,
  username: u.username,
  nombre: u.nombre,
  email: u.email,
  roles: u.roles,
  activo: u.activo,
});

const mensaje = (e: unknown, porDefecto: string) => {
  const r = e as HttpErrorResponse;
  if (r.status === 0) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
  if (r.status === 403) return 'Tu rol no permite esta operación.';
  return r.error?.mensaje ?? porDefecto;
};

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly url = environment.apiUrl;

  async cargarProductos() {
    try {
      const lista = await firstValueFrom(this.http.get<ProductoApi[]>(`${this.url}/productos`));
      this.store.productos.set(lista.map(aProducto));
    } catch (e) {
      this.store.avisar(mensaje(e, 'No se pudieron cargar los productos.'), 'error');
    }
  }

  async cargarVentas() {
    try {
      const lista = await firstValueFrom(this.http.get<VentaApi[]>(`${this.url}/ventas`));
      this.store.ventas.set(
        lista
          .map((v): Venta => ({
            id: v.id,
            usuario: v.usuario,
            fecha: v.fecha,
            total: v.total,
            metodoPago: v.metodo_pago,
            detalle: v.lineas.map((l) => ({ productoId: l.producto_id, nombre: l.nombre, cantidad: l.cantidad, precio: l.precio_unitario })),
          }))
          .reverse(),
      );
    } catch (e) {
      this.store.avisar(mensaje(e, 'No se pudo cargar el historial de ventas.'), 'error');
    }
  }

  async cargarUsuarios() {
    try {
      const lista = await firstValueFrom(this.http.get<UsuarioApi[]>(`${this.url}/usuarios`));
      this.store.usuarios.set(lista.map(aUsuario));
    } catch (e) {
      this.store.avisar(mensaje(e, 'No se pudieron cargar los usuarios.'), 'error');
    }
  }

  async crearProducto(p: Omit<Producto, 'id'>): Promise<Resultado> {
    try {
      const nuevo = await firstValueFrom(
        this.http.post<ProductoApi>(`${this.url}/productos`, {
          sku: p.codigo,
          nombre: p.nombre,
          precio_venta: p.precio,
          stock_actual: p.stock,
        }),
      );
      this.store.productos.update((l) => [...l, aProducto(nuevo)]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo crear el producto.') };
    }
  }

  async actualizarProducto(id: string, precio: number, stock: number): Promise<Resultado> {
    try {
      const p = await firstValueFrom(
        this.http.put<ProductoApi>(`${this.url}/productos/${id}`, { precio_venta: precio, stock_actual: stock }),
      );
      this.store.productos.update((l) => l.map((x) => (x.id === id ? aProducto(p) : x)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo actualizar el producto.') };
    }
  }

  async registrarVenta(lineas: { productoId: string; cantidad: number }[], metodoPago: MetodoPago): Promise<Resultado> {
    if (lineas.length === 0) return { ok: false, error: 'Agrega al menos un producto a la venta.' };
    try {
      await firstValueFrom(
        this.http.post(`${this.url}/ventas`, {
          lineas: lineas.map((l) => ({ producto_id: l.productoId, cantidad: l.cantidad })),
          metodo_pago: metodoPago,
        }),
      );
      await Promise.all([this.cargarProductos(), this.cargarVentas()]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo registrar la venta.') };
    }
  }

  async eliminarProducto(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/productos/${id}`));
      this.store.productos.update((l) => l.filter((x) => x.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo eliminar el producto.') };
    }
  }

  async actualizarMetodoPago(id: string, metodoPago: MetodoPago): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.put(`${this.url}/ventas/${id}`, { metodo_pago: metodoPago }));
      this.store.ventas.update((l) => l.map((v) => (v.id === id ? { ...v, metodoPago } : v)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo actualizar el método de pago.') };
    }
  }

  async anularVenta(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/ventas/${id}`));
      await Promise.all([this.cargarProductos(), this.cargarVentas()]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo anular la venta.') };
    }
  }

  async crearUsuario(u: Omit<Usuario, 'id' | 'activo'>): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.post(`${this.url}/usuarios`, u));
      await this.cargarUsuarios();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo crear el usuario.') };
    }
  }

  async actualizarUsuario(id: string, u: Pick<Usuario, 'nombre' | 'email' | 'roles' | 'activo'>): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.put(`${this.url}/usuarios/${id}`, u));
      await this.cargarUsuarios();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo actualizar el usuario.') };
    }
  }

  async eliminarUsuario(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/usuarios/${id}`));
      this.store.usuarios.update((l) => l.filter((x) => x.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensaje(e, 'No se pudo eliminar el usuario.') };
    }
  }
}
