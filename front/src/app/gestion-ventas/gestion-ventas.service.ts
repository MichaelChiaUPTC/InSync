import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Resultado } from '../core/models';
import { Store } from '../core/store';
import { GestionInventariosService } from '../gestion-inventarios/gestion-inventarios.service';
import { mensajeError } from '../shared/http-error';
import { LineaCarrito, MetodoPago, Venta, VentaApi } from './Interfaces/venta.interface';

@Injectable({ providedIn: 'root' })
export class GestionVentasService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private readonly inventario = inject(GestionInventariosService);
  private get url() { return `${this.store.apiUrl()}/ventas`; }

  async cargarVentas() {
    try {
      const lista = await firstValueFrom(this.http.get<VentaApi[]>(this.url));
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
      this.store.avisar(mensajeError(e, 'No se pudo cargar el historial de ventas.'), 'error');
    }
  }

  async registrarVenta(lineas: LineaCarrito[], metodoPago: MetodoPago): Promise<Resultado> {
    if (lineas.length === 0) return { ok: false, error: 'Agrega al menos un producto a la venta.' };
    try {
      await firstValueFrom(
        this.http.post(this.url, {
          lineas: lineas.map((l) => ({ producto_id: l.productoId, cantidad: l.cantidad })),
          metodo_pago: metodoPago,
        }),
      );
      await Promise.all([this.inventario.cargarProductos(), this.cargarVentas()]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo registrar la venta.') };
    }
  }

  async actualizarMetodoPago(id: string, metodoPago: MetodoPago): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.put(`${this.url}/${id}`, { metodo_pago: metodoPago }));
      this.store.ventas.update((l) => l.map((v) => (v.id === id ? { ...v, metodoPago } : v)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo actualizar el método de pago.') };
    }
  }

  async anularVenta(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/${id}`));
      await Promise.all([this.inventario.cargarProductos(), this.cargarVentas()]);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo anular la venta.') };
    }
  }
}
