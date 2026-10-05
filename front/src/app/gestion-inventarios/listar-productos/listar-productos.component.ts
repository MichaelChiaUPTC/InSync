import { Component, computed, inject, signal } from '@angular/core';
import { Store } from '../../core/store';
import { formatoCOP } from '../../shared/format';
import { GestionInventariosService } from '../gestion-inventarios.service';
import { Producto } from '../Interfaces/producto.interface';

const TAM = 8;
const STOCK_BAJO = 5;

@Component({
  selector: 'app-listar-productos',
  standalone: false,
  templateUrl: './listar-productos.component.html',
  styleUrl: './listar-productos.component.css',
})
export class ListarProductosComponent {
  protected readonly store = inject(Store);
  private readonly servicio = inject(GestionInventariosService);
  protected readonly cop = formatoCOP;
  protected readonly bajo = STOCK_BAJO;

  protected readonly puedeEditar = computed(() => this.store.tieneRol('erp_inventario', 'erp_admin'));
  protected readonly q = signal('');
  protected readonly pag = signal(0);
  protected readonly panel = signal<'nuevo' | 'editar' | null>(null);
  protected readonly editando = signal<Producto | null>(null);

  constructor() { this.servicio.cargarProductos(); }

  protected readonly filtrados = computed(() => {
    const t = this.q().trim().toLowerCase();
    return this.store.productos().filter((p) => !t || p.codigo.toLowerCase().includes(t) || p.nombre.toLowerCase().includes(t));
  });
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.filtrados().length / TAM)));
  protected readonly pagina = computed(() => this.filtrados().slice(this.pag() * TAM, this.pag() * TAM + TAM));
  protected readonly desde = computed(() => this.pag() * TAM + 1);
  protected readonly hasta = computed(() => Math.min(this.filtrados().length, this.pag() * TAM + TAM));

  protected buscar(v: string) { this.q.set(v); this.pag.set(0); }
  protected ir(d: number) { this.pag.update((p) => Math.min(this.paginas() - 1, Math.max(0, p + d))); }

  protected nuevo() {
    this.editando.set(null);
    this.panel.set('nuevo');
  }

  protected editar(p: Producto) {
    this.editando.set(p);
    this.panel.set('editar');
  }

  protected async eliminar(p: Producto) {
    if (!confirm(`¿Eliminar ${p.nombre}? Esta acción no se puede deshacer.`)) return;
    const r = await this.servicio.eliminarProducto(p.id);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    if (this.editando()?.id === p.id) this.cerrar();
    this.store.avisar(`${p.nombre} eliminado.`);
  }

  protected cerrar() { this.panel.set(null); this.editando.set(null); }
}
