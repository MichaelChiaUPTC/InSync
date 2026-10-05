import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/store';
import { GestionInventariosService } from '../../gestion-inventarios/gestion-inventarios.service';
import { formatoCOP, formatoFecha } from '../../shared/format';
import { GestionVentasService } from '../gestion-ventas.service';
import { METODOS_PAGO, MetodoPago, Venta } from '../Interfaces/venta.interface';

@Component({
  selector: 'app-listar-ventas',
  standalone: false,
  templateUrl: './listar-ventas.component.html',
  styleUrl: './listar-ventas.component.css',
})
export class ListarVentasComponent {
  protected readonly store = inject(Store);
  private readonly servicio = inject(GestionVentasService);
  private readonly inventario = inject(GestionInventariosService);
  protected readonly cop = formatoCOP;
  protected readonly fecha = formatoFecha;
  protected readonly metodos = METODOS_PAGO;

  protected readonly puedeVender = computed(() => this.store.tieneRol('erp_ventas', 'erp_admin'));
  protected readonly esAdmin = computed(() => this.store.tieneRol('erp_admin'));
  protected readonly vista = signal<'nueva' | 'historial'>(this.store.tieneRol('erp_ventas', 'erp_admin') ? 'nueva' : 'historial');

  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly abierta = signal<string | null>(null);

  constructor() {
    this.inventario.cargarProductos();
    this.servicio.cargarVentas();
  }

  protected readonly filtradas = computed(() => {
    const d = this.desde() ? new Date(this.desde() + 'T00:00:00').getTime() : -Infinity;
    const h = this.hasta() ? new Date(this.hasta() + 'T23:59:59').getTime() : Infinity;
    return this.store.ventas().filter((v) => {
      const f = new Date(v.fecha).getTime();
      return f >= d && f <= h;
    });
  });
  protected readonly sumaFiltrada = computed(() => this.filtradas().reduce((t, v) => t + v.total, 0));

  protected etiquetaPago(m: MetodoPago) { return METODOS_PAGO.find((x) => x.id === m)?.etiqueta ?? m; }

  protected async cambiarPago(v: Venta, nuevo: MetodoPago) {
    const r = await this.servicio.actualizarMetodoPago(v.id, nuevo);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    this.store.avisar(`Venta #${v.id.slice(0, 8)}: pago con ${this.etiquetaPago(nuevo).toLowerCase()}.`);
  }

  protected async anular(v: Venta) {
    if (!confirm(`¿Anular la venta #${v.id.slice(0, 8)} por ${formatoCOP(v.total)}? El stock se devolverá al inventario.`)) return;
    const r = await this.servicio.anularVenta(v.id);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    if (this.abierta() === v.id) this.abierta.set(null);
    this.store.avisar('Venta anulada y stock devuelto.');
  }
}
