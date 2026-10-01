import { Component, computed, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Producto } from '../core/models';
import { Store } from '../core/store';
import { formatoCOP } from '../shared/format';
import { Icon } from '../shared/icon';

const TAM = 8;
const STOCK_BAJO = 5;

@Component({
  selector: 'app-inventario',
  imports: [Icon],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Inventario</h1>
          <p>
            {{ store.productos().length }} productos en {{ store.tenant()?.nombre }}.
            @if (!puedeEditar()) { Tu rol solo permite consultar. }
          </p>
        </div>
        @if (puedeEditar()) {
          <button type="button" class="btn btn-primary" (click)="nuevo()"><app-icon name="plus" /> Nuevo producto</button>
        }
      </header>

      <div class="split" [class.open]="panel()">
        <section>
          <div class="toolbar">
            <div class="search">
              <app-icon name="search" [size]="18" />
              <label for="q" class="sr-only">Buscar producto</label>
              <input id="q" class="input" type="search" placeholder="Buscar por código o nombre" [value]="q()" (input)="buscar($any($event.target).value)" />
            </div>
          </div>

          <div class="surface">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Código</th><th>Producto</th><th class="num">Precio</th><th class="num">Stock</th><th>Estado</th>
                    @if (puedeEditar()) { <th><span class="sr-only">Acciones</span></th> }
                  </tr>
                </thead>
                <tbody>
                  @for (p of pagina(); track p.id) {
                    <tr [class.sel]="editando()?.id === p.id">
                      <td class="code">{{ p.codigo }}</td>
                      <td>{{ p.nombre }}</td>
                      <td class="num">{{ cop(p.precio) }}</td>
                      <td class="num">{{ p.stock }}</td>
                      <td>
                        @if (p.stock === 0) { <span class="pill bad">Agotado</span> }
                        @else if (p.stock <= bajo) { <span class="pill warn">Stock bajo</span> }
                        @else { <span class="pill ok">Disponible</span> }
                      </td>
                      @if (puedeEditar()) {
                        <td class="actions">
                          <button type="button" class="btn btn-ghost btn-sm" (click)="editar(p)" [attr.aria-label]="'Editar ' + p.nombre"><app-icon name="pencil" [size]="16" /> Editar</button>
                          <button type="button" class="btn btn-ghost btn-sm" (click)="eliminar(p)" [attr.aria-label]="'Eliminar ' + p.nombre"><app-icon name="trash" [size]="16" /> Eliminar</button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (filtrados().length === 0) {
              <div class="empty"><strong>Sin resultados</strong>Ningún producto coincide con “{{ q() }}”.</div>
            } @else {
              <div class="pager">
                <span>{{ desde() }}–{{ hasta() }} de {{ filtrados().length }}</span>
                <div class="btn-group">
                  <button type="button" class="btn btn-secondary btn-sm btn-icon" (click)="ir(-1)" [disabled]="pag() === 0" aria-label="Página anterior"><app-icon name="left" [size]="18" /></button>
                  <button type="button" class="btn btn-secondary btn-sm btn-icon" (click)="ir(1)" [disabled]="pag() >= paginas() - 1" aria-label="Página siguiente"><app-icon name="right" [size]="18" /></button>
                </div>
              </div>
            }
          </div>
        </section>

        @if (panel(); as modo) {
          <aside class="surface panel" aria-label="Formulario de producto">
            <div class="panel-head">
              <h2>{{ modo === 'nuevo' ? 'Nuevo producto' : 'Editar producto' }}</h2>
              <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="cerrar()" aria-label="Cerrar formulario"><app-icon name="x" [size]="18" /></button>
            </div>
            <form (submit)="guardar($event)" novalidate class="form">
              <div class="field">
                <label for="codigo">Código</label>
                <input id="codigo" class="input" [readOnly]="modo === 'editar'" [value]="codigo()" (input)="codigo.set($any($event.target).value)" placeholder="Ej. ARR-01" autocomplete="off" />
                @if (modo === 'nuevo') { <span class="hint">Debe ser único en este inventario.</span> }
              </div>
              <div class="field">
                <label for="nombre">Nombre</label>
                <input id="nombre" class="input" [readOnly]="modo === 'editar'" [value]="nombre()" (input)="nombre.set($any($event.target).value)" autocomplete="off" />
              </div>
              <div class="dos">
                <div class="field">
                  <label for="precio">Precio (COP)</label>
                  <input id="precio" class="input" type="number" min="1" step="100" inputmode="numeric" [value]="precio()" (input)="precio.set($any($event.target).value)" />
                </div>
                <div class="field">
                  <label for="stock">Stock</label>
                  <input id="stock" class="input" type="number" min="0" step="1" inputmode="numeric" [value]="stock()" (input)="stock.set($any($event.target).value)" />
                </div>
              </div>
              @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
              <div class="fila">
                <button type="submit" class="btn btn-primary">{{ modo === 'nuevo' ? 'Crear producto' : 'Guardar cambios' }}</button>
                <button type="button" class="btn btn-secondary" (click)="cerrar()">Cancelar</button>
              </div>
            </form>
          </aside>
        }
      </div>
    </div>
  `,
  styles: `
    tr.sel { background: #eef0ff; }
    .form { display: grid; gap: 16px; }
    .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fila { display: flex; gap: 8px; flex-wrap: wrap; }
    aside { position: sticky; top: 24px; }
  `,
})
export class Inventario {
  protected readonly store = inject(Store);
  private readonly api = inject(Api);
  protected readonly cop = formatoCOP;
  protected readonly bajo = STOCK_BAJO;

  protected readonly puedeEditar = computed(() => this.store.tieneRol('erp_inventario', 'erp_admin'));
  protected readonly q = signal('');
  protected readonly pag = signal(0);
  protected readonly panel = signal<'nuevo' | 'editar' | null>(null);
  protected readonly editando = signal<Producto | null>(null);

  protected readonly codigo = signal('');
  protected readonly nombre = signal('');
  protected readonly precio = signal('');
  protected readonly stock = signal('');
  protected readonly error = signal('');

  constructor() { this.api.cargarProductos(); }

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
    this.codigo.set(''); this.nombre.set(''); this.precio.set(''); this.stock.set('0');
    this.error.set('');
    this.panel.set('nuevo');
  }

  protected editar(p: Producto) {
    this.editando.set(p);
    this.codigo.set(p.codigo); this.nombre.set(p.nombre);
    this.precio.set(String(p.precio)); this.stock.set(String(p.stock));
    this.error.set('');
    this.panel.set('editar');
  }

  protected async eliminar(p: Producto) {
    if (!confirm(`¿Eliminar ${p.nombre}? Esta acción no se puede deshacer.`)) return;
    const r = await this.api.eliminarProducto(p.id);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    if (this.editando()?.id === p.id) this.cerrar();
    this.store.avisar(`${p.nombre} eliminado.`);
  }

  protected cerrar() { this.panel.set(null); this.editando.set(null); }

  protected async guardar(ev: Event) {
    ev.preventDefault();
    const precio = Number(this.precio());
    const stock = Number(this.stock());
    if (this.panel() === 'nuevo' && (!this.codigo().trim() || !this.nombre().trim())) {
      return this.error.set('Completa el código y el nombre del producto.');
    }
    if (!Number.isFinite(precio) || precio <= 0) return this.error.set('El precio debe ser mayor que cero.');
    if (!Number.isInteger(stock) || stock < 0) return this.error.set('El stock debe ser un número entero, cero o más.');

    if (this.panel() === 'nuevo') {
      const codigo = this.codigo().trim().toUpperCase();
      const r = await this.api.crearProducto({ codigo, nombre: this.nombre().trim(), precio, stock });
      if (!r.ok) return this.error.set(r.error);
      this.store.avisar(`Producto ${codigo} creado.`);
    } else {
      const r = await this.api.actualizarProducto(this.editando()!.id, precio, stock);
      if (!r.ok) return this.error.set(r.error);
      this.store.avisar(`${this.nombre()} actualizado.`);
    }
    this.cerrar();
  }
}
