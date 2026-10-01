import { Component, computed, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { METODOS_PAGO, MetodoPago, Venta } from '../core/models';
import { Store } from '../core/store';
import { formatoCOP, formatoFecha } from '../shared/format';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-ventas',
  imports: [Icon],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Ventas</h1>
          <p>Registra ventas del mostrador o revisa lo vendido en {{ store.tenant()?.nombre }}.</p>
        </div>
        <div class="tabs" role="tablist" aria-label="Vista de ventas">
          @if (puedeVender()) {
            <button type="button" role="tab" [attr.aria-selected]="vista() === 'nueva'" [class.on]="vista() === 'nueva'" (click)="vista.set('nueva')"><app-icon name="cart" [size]="18" /> Nueva venta</button>
          }
          <button type="button" role="tab" [attr.aria-selected]="vista() === 'historial'" [class.on]="vista() === 'historial'" (click)="vista.set('historial')"><app-icon name="history" [size]="18" /> Historial</button>
        </div>
      </header>

      @if (vista() === 'nueva') {
        <div class="caja">
          <section>
            <div class="toolbar">
              <div class="search">
                <app-icon name="search" [size]="18" />
                <label for="q" class="sr-only">Buscar producto</label>
                <input id="q" class="input" type="search" placeholder="Buscar producto para vender" [value]="q()" (input)="q.set($any($event.target).value)" />
              </div>
            </div>
            <div class="surface lista">
              @for (p of catalogo(); track p.id) {
                <div class="item" [class.agotado]="p.stock === 0">
                  <div class="info">
                    <strong>{{ p.nombre }}</strong>
                    <small class="muted">{{ p.codigo }} · {{ p.stock === 0 ? 'Agotado' : p.stock + ' disponibles' }}</small>
                  </div>
                  <span class="precio">{{ cop(p.precio) }}</span>
                  <button type="button" class="btn btn-secondary btn-sm" (click)="agregar(p.id)" [disabled]="p.stock === 0 || cantidadEn(p.id) >= p.stock" [attr.aria-label]="'Agregar ' + p.nombre">
                    <app-icon name="plus" [size]="16" /> Agregar
                  </button>
                </div>
              } @empty {
                <div class="empty"><strong>Sin resultados</strong>Ningún producto coincide con “{{ q() }}”.</div>
              }
            </div>
          </section>

          <aside class="surface ticket" aria-label="Venta actual">
            <h2>Venta actual</h2>
            @if (lineas().length === 0) {
              <p class="vacio muted">Aún no agregas productos. Elige uno de la lista para empezar.</p>
            } @else {
              <ul class="lineas">
                @for (l of lineas(); track l.p.id) {
                  <li>
                    <div class="nom">
                      <span>{{ l.p.nombre }}</span>
                      <small class="muted">{{ cop(l.p.precio) }} c/u</small>
                    </div>
                    <div class="paso" role="group" [attr.aria-label]="'Cantidad de ' + l.p.nombre">
                      <button type="button" class="btn btn-secondary btn-sm btn-icon" (click)="cambiar(l.p.id, -1)" aria-label="Quitar una unidad"><app-icon name="minus" [size]="16" /></button>
                      <span class="cant" aria-live="polite">{{ l.cantidad }}</span>
                      <button type="button" class="btn btn-secondary btn-sm btn-icon" (click)="cambiar(l.p.id, 1)" [disabled]="l.cantidad >= l.p.stock" aria-label="Agregar una unidad"><app-icon name="plus" [size]="16" /></button>
                    </div>
                    <span class="sub">{{ cop(l.cantidad * l.p.precio) }}</span>
                  </li>
                }
              </ul>
            }
            <div class="field">
              <label for="mp">Método de pago</label>
              <select id="mp" class="input" [value]="metodoPago()" (change)="metodoPago.set($any($event.target).value)">
                @for (m of metodos; track m.id) { <option [value]="m.id">{{ m.etiqueta }}</option> }
              </select>
            </div>
            <div class="total"><span>Total</span><strong>{{ cop(total()) }}</strong></div>
            @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
            <button type="button" class="btn btn-primary" (click)="registrar()" [disabled]="lineas().length === 0">Registrar venta</button>
            @if (lineas().length > 0) {
              <button type="button" class="btn btn-ghost" (click)="carrito.set([])">Vaciar venta</button>
            }
          </aside>
        </div>
      } @else {
        <div class="toolbar">
          <div class="field">
            <label for="d">Desde</label>
            <input id="d" class="input" type="date" [value]="desde()" (input)="desde.set($any($event.target).value)" />
          </div>
          <div class="field">
            <label for="h">Hasta</label>
            <input id="h" class="input" type="date" [value]="hasta()" (input)="hasta.set($any($event.target).value)" />
          </div>
          @if (desde() || hasta()) {
            <button type="button" class="btn btn-ghost btn-sm limpiar" (click)="desde.set(''); hasta.set('')"><app-icon name="x" [size]="16" /> Limpiar filtro</button>
          }
        </div>
        <div class="surface">
          <div class="table-wrap">
            <table>
              <thead><tr><th>N.º</th><th>Fecha</th><th>Vendedor</th><th>Pago</th><th class="num">Líneas</th><th class="num">Total</th><th><span class="sr-only">Detalle</span></th></tr></thead>
              <tbody>
                @for (v of filtradas(); track v.id) {
                  <tr>
                    <td class="code">#{{ v.id.slice(0, 8) }}</td>
                    <td>{{ fecha(v.fecha) }}</td>
                    <td>{{ v.usuario }}</td>
                    <td>
                      @if (puedeVender()) {
                        <select class="input pago" [value]="v.metodoPago" (change)="cambiarPago(v, $any($event.target).value)" [attr.aria-label]="'Método de pago de la venta ' + v.id.slice(0, 8)">
                          @for (m of metodos; track m.id) { <option [value]="m.id">{{ m.etiqueta }}</option> }
                        </select>
                      } @else { {{ etiquetaPago(v.metodoPago) }} }
                    </td>
                    <td class="num">{{ v.detalle.length }}</td>
                    <td class="num"><strong>{{ cop(v.total) }}</strong></td>
                    <td class="actions">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="abierta.set(abierta() === v.id ? null : v.id)" [attr.aria-expanded]="abierta() === v.id">
                        Detalle <app-icon [name]="abierta() === v.id ? 'down' : 'right'" [size]="16" />
                      </button>
                      @if (esAdmin()) {
                        <button type="button" class="btn btn-ghost btn-sm" (click)="anular(v)" [attr.aria-label]="'Anular venta ' + v.id.slice(0, 8)"><app-icon name="trash" [size]="16" /> Anular</button>
                      }
                    </td>
                  </tr>
                  @if (abierta() === v.id) {
                    <tr class="detalle">
                      <td colspan="7">
                        <ul>
                          @for (l of v.detalle; track l.productoId) {
                            <li><span>{{ l.cantidad }} × {{ l.nombre }}</span><span>{{ cop(l.cantidad * l.precio) }}</span></li>
                          }
                        </ul>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
          @if (filtradas().length === 0) {
            <div class="empty"><strong>Sin ventas en ese rango</strong>Prueba con otras fechas o limpia el filtro.</div>
          } @else {
            <div class="pager"><span>{{ filtradas().length }} ventas</span><strong class="sumado">{{ cop(sumaFiltrada()) }}</strong></div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .tabs { display: inline-flex; padding: 4px; gap: 4px; background: var(--color-muted); border-radius: 10px; }
    .tabs button { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 16px; border: 0; border-radius: 7px; background: transparent; color: var(--color-muted-foreground); font-weight: 600; cursor: pointer; transition: background-color 200ms var(--ease), color 200ms var(--ease); }
    .tabs button:hover { color: var(--color-primary-text); }
    .tabs button.on { background: #fff; color: var(--color-primary-text); box-shadow: var(--shadow-sm); }
    .pago { width: auto; min-height: 36px; padding: 4px 28px 4px 10px; }
    .caja { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: var(--space-lg); align-items: start; }
    .item { display: flex; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid var(--color-border); }
    .item:last-child { border-bottom: 0; }
    .item.agotado .info, .item.agotado .precio { opacity: 0.55; }
    .info { display: grid; flex: 1; min-width: 0; }
    .precio { font-weight: 600; white-space: nowrap; }
    .ticket { position: sticky; top: 24px; padding: var(--space-lg); display: grid; gap: 16px; }
    .vacio { padding: 16px 0; }
    .lineas { list-style: none; margin: 0; padding: 0; display: grid; }
    .lineas li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--color-border); }
    .nom { display: grid; min-width: 0; }
    .paso { display: inline-flex; align-items: center; gap: 6px; }
    .cant { min-width: 24px; text-align: center; font-weight: 600; }
    .sub { min-width: 84px; text-align: right; font-weight: 600; }
    .total { display: flex; align-items: baseline; justify-content: space-between; padding-top: 4px; }
    .total span { font: 600 1rem var(--font-head); color: var(--color-muted-foreground); }
    .total strong { font: 600 1.75rem var(--font-head); color: var(--color-primary-text); }
    .ticket .btn { width: 100%; }
    .limpiar { align-self: flex-end; }
    .toolbar .field { min-width: 170px; }
    tr.detalle td { background: var(--color-muted); padding: 8px 16px 12px 16px; }
    tr.detalle ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; max-width: 520px; }
    tr.detalle li { display: flex; justify-content: space-between; gap: 16px; }
    .sumado { color: var(--color-primary-text); font-size: 1.125rem; }
    small { font-size: 0.875rem; }
    @media (max-width: 900px) {
      .caja { grid-template-columns: minmax(0, 1fr); }
      .ticket { position: static; }
      .item { flex-wrap: wrap; }
    }
  `,
})
export class Ventas {
  protected readonly store = inject(Store);
  private readonly api = inject(Api);
  protected readonly cop = formatoCOP;
  protected readonly fecha = formatoFecha;

  protected readonly puedeVender = computed(() => this.store.tieneRol('erp_ventas', 'erp_admin'));
  protected readonly vista = signal<'nueva' | 'historial'>(this.store.tieneRol('erp_ventas', 'erp_admin') ? 'nueva' : 'historial');

  protected readonly q = signal('');
  protected readonly carrito = signal<{ productoId: string; cantidad: number }[]>([]);
  protected readonly error = signal('');

  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly abierta = signal<string | null>(null);

  constructor() {
    this.api.cargarProductos();
    this.api.cargarVentas();
  }

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

  protected readonly filtradas = computed(() => {
    const d = this.desde() ? new Date(this.desde() + 'T00:00:00').getTime() : -Infinity;
    const h = this.hasta() ? new Date(this.hasta() + 'T23:59:59').getTime() : Infinity;
    return this.store.ventas().filter((v) => {
      const f = new Date(v.fecha).getTime();
      return f >= d && f <= h;
    });
  });
  protected readonly sumaFiltrada = computed(() => this.filtradas().reduce((t, v) => t + v.total, 0));

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

  protected readonly metodos = METODOS_PAGO;
  protected readonly metodoPago = signal<MetodoPago>('efectivo');

  protected etiquetaPago(m: MetodoPago) { return METODOS_PAGO.find((x) => x.id === m)?.etiqueta ?? m; }

  protected async cambiarPago(v: Venta, nuevo: MetodoPago) {
    const r = await this.api.actualizarMetodoPago(v.id, nuevo);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    this.store.avisar(`Venta #${v.id.slice(0, 8)}: pago con ${this.etiquetaPago(nuevo).toLowerCase()}.`);
  }

  protected readonly esAdmin = computed(() => this.store.tieneRol('erp_admin'));

  protected async anular(v: Venta) {
    if (!confirm(`¿Anular la venta #${v.id.slice(0, 8)} por ${formatoCOP(v.total)}? El stock se devolverá al inventario.`)) return;
    const r = await this.api.anularVenta(v.id);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    if (this.abierta() === v.id) this.abierta.set(null);
    this.store.avisar('Venta anulada y stock devuelto.');
  }

  protected async registrar() {
    const total = this.total();
    const r = await this.api.registrarVenta(this.carrito(), this.metodoPago());
    if (!r.ok) return this.error.set(r.error);
    this.carrito.set([]);
    this.metodoPago.set('efectivo');
    this.error.set('');
    this.store.avisar(`Venta registrada por ${formatoCOP(total)}. El stock se actualizó.`);
  }
}
