import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/store';
import { formatoCOP } from '../../shared/format';
import { GestionVentasService } from '../gestion-ventas.service';
import { LineaCarrito, METODOS_PAGO, MetodoPago } from '../Interfaces/venta.interface';

@Component({
  selector: 'app-crear-venta',
  standalone: false,
  templateUrl: './crear-venta.component.html',
  styleUrl: './crear-venta.component.css',
})
export class CrearVentaComponent {
  private readonly store = inject(Store);
  private readonly servicio = inject(GestionVentasService);
  protected readonly cop = formatoCOP;
  protected readonly metodos = METODOS_PAGO;

  protected readonly q = signal('');
  protected readonly carrito = signal<LineaCarrito[]>([]);
  protected readonly metodoPago = signal<MetodoPago>('efectivo');
  protected readonly error = signal('');

  protected readonly catalogo = computed(() => {
    const t = this.q().trim().toLowerCase();
    return this.store.productos().filter((p) => !t || p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t));
  });

  protected readonly lineas = computed(() =>
    this.carrito()
      .map((c) => ({ p: this.store.productos().find((x) => x.id === c.productoId)!, cantidad: c.cantidad }))
      .filter((l) => l.p),
  );
  protected readonly total = computed(() => this.lineas().reduce((t, l) => t + l.cantidad * l.p.precio, 0));

  protected cantidadEn(id: string) { return this.carrito().find((c) => c.productoId === id)?.cantidad ?? 0; }

  protected agregar(id: string) { this.cambiar(id, 1); }

  protected cambiar(id: string, delta: number) {
    this.error.set('');
    const stock = this.store.productos().find((p) => p.id === id)?.stock ?? 0;
    this.carrito.update((c) => {
      const actual = c.find((x) => x.productoId === id);
      const nueva = Math.min(stock, (actual?.cantidad ?? 0) + delta);
      if (nueva <= 0) return c.filter((x) => x.productoId !== id);
      return actual ? c.map((x) => (x.productoId === id ? { ...x, cantidad: nueva } : x)) : [...c, { productoId: id, cantidad: nueva }];
    });
  }

  protected async registrar() {
    const total = this.total();
    const r = await this.servicio.registrarVenta(this.carrito(), this.metodoPago());
    if (!r.ok) return this.error.set(r.error);
    this.carrito.set([]);
    this.metodoPago.set('efectivo');
    this.error.set('');
    this.store.avisar(`Venta registrada por ${formatoCOP(total)}. El stock se actualizó.`);
  }
}
