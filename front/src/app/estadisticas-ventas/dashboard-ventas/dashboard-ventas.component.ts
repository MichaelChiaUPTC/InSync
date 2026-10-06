import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Store } from '../../core/store';
import { GestionVentasService } from '../../gestion-ventas/gestion-ventas.service';
import { MetodoPago } from '../../gestion-ventas/Interfaces/venta.interface';
import { formatoCOP } from '../../shared/format';
import { escala, filtrarPorRango, porMetodo, porVendedor, resumen, topProductos, ventasPorDia } from '../estadisticas';

interface FilaTip { k: string; v: string; color?: string }
interface Tip { card: string; x: number; y: number; ancho: number; titulo: string; filas: FilaTip[] }

// Un color por metodo de pago, fijo (paleta categorica validada: azul, naranja, aqua).
// El color sigue al metodo, no a su posicion: filtrar el periodo no repinta.
const COLOR_PAGO: Record<MetodoPago, string> = {
  efectivo: '#2a78d6',
  tarjeta: '#eb6834',
  transferencia: '#1baf7a',
};

const compacto = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const diaCorto = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const diaLargo = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
const entero = new Intl.NumberFormat('es-CO');
const porcentaje = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

const ALTO = 260;
const M = { izq: 56, der: 20, arr: 30, abj: 30 };

@Component({
  selector: 'app-dashboard-ventas',
  standalone: false,
  templateUrl: './dashboard-ventas.component.html',
  styleUrl: './dashboard-ventas.component.css',
})
export class DashboardVentasComponent {
  protected readonly store = inject(Store);
  private readonly servicio = inject(GestionVentasService);
  protected readonly cop = formatoCOP;
  protected readonly alto = ALTO;
  protected readonly margen = M;
  protected readonly colorPago = COLOR_PAGO;
  protected readonly n = (v: number) => entero.format(v);
  protected readonly pct = (v: number) => porcentaje.format(v);
  protected readonly dia = (d: Date) => diaCorto.format(d);

  protected readonly rangos = [
    { id: 'hoy', texto: 'Hoy', dias: 1 },
    { id: '7', texto: '7 días', dias: 7 },
    { id: '30', texto: '30 días', dias: 30 },
    { id: 'todo', texto: 'Todo', dias: null },
  ];
  protected readonly rango = signal('30');
  protected readonly vista = signal<'graficas' | 'tablas'>('graficas');
  protected readonly cargando = signal(true);
  protected readonly ancho = signal(640);
  protected readonly activo = signal<number | null>(null);
  protected readonly tip = signal<Tip | null>(null);

  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');

  constructor() {
    this.servicio.cargarVentas().finally(() => this.cargando.set(false));

    // El ancho del grafico de linea sigue al de su tarjeta (sin deformar textos ni puntos)
    effect((alLimpiar) => {
      const el = this.lienzo()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') return;
      const medir = (w: number) => { if (w > 0) this.ancho.set(Math.max(300, Math.floor(w))); };
      medir(el.clientWidth);
      const ro = new ResizeObserver(([e]) => medir(e.contentRect.width));
      ro.observe(el);
      alLimpiar(() => ro.disconnect());
    });
  }

  private readonly dias = computed(() => this.rangos.find((r) => r.id === this.rango())?.dias ?? null);
  protected readonly ventas = computed(() => filtrarPorRango(this.store.ventas(), this.dias()));
  protected readonly resumen = computed(() => resumen(this.ventas()));
  protected readonly serie = computed(() => ventasPorDia(this.ventas(), this.dias()));
  protected readonly productos = computed(() => topProductos(this.ventas(), 6));
  protected readonly vendedores = computed(() => porVendedor(this.ventas(), 6));
  protected readonly pagos = computed(() => porMetodo(this.ventas()));

  // Geometria del grafico de linea, en pixeles reales del contenedor
  protected readonly geo = computed(() => {
    const w = this.ancho();
    const s = this.serie();
    const pw = w - M.izq - M.der;
    const ph = ALTO - M.arr - M.abj;
    const base = M.arr + ph;
    const esc = escala(Math.max(0, ...s.map((p) => p.ingresos)));
    const x = (i: number) => M.izq + (s.length <= 1 ? pw / 2 : (i * pw) / (s.length - 1));
    const y = (v: number) => base - (v / esc.tope) * ph;

    const puntos = s.map((p, i) => ({ ...p, x: x(i), y: y(p.ingresos) }));
    const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
    const area = puntos.length > 1
      ? `${linea}L${puntos[puntos.length - 1].x.toFixed(1)},${base}L${puntos[0].x.toFixed(1)},${base}Z`
      : '';
    const paso = Math.max(1, Math.ceil(puntos.length / Math.max(2, Math.floor(pw / 72))));
    const pico = puntos.length > 1 && puntos.some((p) => p.ingresos > 0)
      ? puntos.reduce((a, b) => (b.ingresos > a.ingresos ? b : a))
      : null;

    return {
      w, pw, ph, base, puntos, linea, area, pico,
      ultimo: puntos.length ? puntos[puntos.length - 1] : null,
      marcasY: esc.marcas.map((v) => ({ y: y(v), texto: compacto.format(v) })),
      // Se cuenta desde el final: la ultima etiqueta es siempre el dia mas reciente
      marcasX: puntos.filter((_, i) => (puntos.length - 1 - i) % paso === 0).map((p) => ({ x: p.x, texto: diaCorto.format(p.fecha).replace(' de ', ' ') })),
      xPico: pico ? Math.min(Math.max(pico.x, M.izq + 36), w - M.der - 36) : 0,
    };
  });

  protected readonly resumenAccesible = computed(() => {
    const r = this.resumen();
    return `Ingresos por día: ${formatoCOP(r.ingresos)} en ${this.serie().length} días. Con el teclado, usa las flechas izquierda y derecha para recorrer los días.`;
  });

  // ---- Interaccion (lo que muestra el tooltip tambien esta en la vista de tablas)

  protected moverLinea(ev: PointerEvent) {
    const g = this.geo();
    if (!g.puntos.length) return;
    const caja = (ev.currentTarget as HTMLElement | SVGElement).getBoundingClientRect();
    const t = caja.width ? (ev.clientX - caja.left) / caja.width : 0;
    this.fijarPunto(Math.round(t * (g.puntos.length - 1)));
  }

  protected teclaLinea(ev: KeyboardEvent) {
    const total = this.geo().puntos.length;
    if (!total) return;
    const actual = this.activo() ?? total - 1;
    if (ev.key === 'ArrowLeft') this.fijarPunto(actual - 1);
    else if (ev.key === 'ArrowRight') this.fijarPunto(actual + 1);
    else if (ev.key === 'Home') this.fijarPunto(0);
    else if (ev.key === 'End') this.fijarPunto(total - 1);
    else if (ev.key === 'Escape') return this.cerrarTip();
    else return;
    ev.preventDefault();
  }

  protected enfocarLinea() {
    const total = this.geo().puntos.length;
    if (total && this.activo() === null) this.fijarPunto(total - 1);
  }

  private fijarPunto(i: number) {
    const g = this.geo();
    const idx = Math.min(Math.max(i, 0), g.puntos.length - 1);
    const p = g.puntos[idx];
    this.activo.set(idx);
    this.tip.set({
      card: 'dias', x: p.x, y: p.y, ancho: g.w,
      titulo: diaLargo.format(p.fecha),
      filas: [
        { k: 'Ingresos', v: formatoCOP(p.ingresos), color: 'var(--color-primary)' },
        { k: 'Ventas', v: entero.format(p.ventas) },
      ],
    });
  }

  protected mostrar(ev: Event, card: string, titulo: string, filas: FilaTip[]) {
    const el = ev.currentTarget as HTMLElement;
    const host = el.closest('.viz') as HTMLElement | null;
    if (!host) return;
    const h = host.getBoundingClientRect();
    let x: number;
    let y: number;
    if (ev instanceof MouseEvent) {
      x = ev.clientX - h.left;
      y = ev.clientY - h.top;
    } else {
      const r = el.getBoundingClientRect();
      x = r.left - h.left + r.width / 2;
      y = r.top - h.top + r.height / 2;
    }
    this.tip.set({ card, x, y, ancho: h.width, titulo, filas });
  }

  protected cerrarTip() {
    this.activo.set(null);
    this.tip.set(null);
  }

  protected filasBarra(b: { ingresos: number; unidades: number; ventas: number }): FilaTip[] {
    return [
      { k: 'Ingresos', v: formatoCOP(b.ingresos), color: 'var(--color-primary)' },
      { k: 'Unidades', v: entero.format(b.unidades) },
      { k: 'Ventas', v: entero.format(b.ventas) },
    ];
  }

  protected filasPago(p: { ingresos: number; ventas: number; pct: number; id: MetodoPago }): FilaTip[] {
    return [
      { k: 'Ingresos', v: formatoCOP(p.ingresos), color: COLOR_PAGO[p.id] },
      { k: 'Ventas', v: entero.format(p.ventas) },
      { k: 'Del total', v: `${porcentaje.format(p.pct)} %` },
    ];
  }
}
