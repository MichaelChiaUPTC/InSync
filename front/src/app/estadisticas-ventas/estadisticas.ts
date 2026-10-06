import { METODOS_PAGO, MetodoPago, Venta } from '../gestion-ventas/Interfaces/venta.interface';

export interface PuntoDia { dia: string; fecha: Date; ingresos: number; ventas: number }
export interface Barra { clave: string; etiqueta: string; ingresos: number; unidades: number; ventas: number; pct: number }
export interface PorMetodo { id: MetodoPago; etiqueta: string; ingresos: number; ventas: number; pct: number }
export interface Resumen { ingresos: number; ventas: number; ticket: number; unidades: number }

const soloDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const claveDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ms = (v: Venta) => new Date(v.fecha).getTime();

// dias = null -> todo el historial; 1 = hoy; 7, 30... = ultimos N dias contando hoy
export const filtrarPorRango = (ventas: Venta[], dias: number | null, ahora = new Date()): Venta[] => {
  if (dias === null) return ventas;
  const desde = sumarDias(soloDia(ahora), -(dias - 1)).getTime();
  return ventas.filter((v) => ms(v) >= desde);
};

export const resumen = (ventas: Venta[]): Resumen => {
  const ingresos = ventas.reduce((t, v) => t + v.total, 0);
  const unidades = ventas.reduce((t, v) => t + v.detalle.reduce((u, l) => u + l.cantidad, 0), 0);
  return { ingresos, ventas: ventas.length, ticket: ventas.length ? ingresos / ventas.length : 0, unidades };
};

// Un punto por dia (incluye los dias sin ventas, en cero) para que la linea no mienta sobre los huecos
export const ventasPorDia = (ventas: Venta[], dias: number | null, ahora = new Date()): PuntoDia[] => {
  const ultima = ventas.length ? soloDia(new Date(Math.max(...ventas.map(ms)))) : null;
  const hoy = soloDia(ahora);
  const fin = ultima && ultima > hoy ? ultima : hoy;

  let inicio: Date;
  if (dias !== null) inicio = sumarDias(hoy, -(dias - 1));
  else if (ventas.length) inicio = soloDia(new Date(Math.min(...ventas.map(ms))));
  else return [];

  const puntos = new Map<string, PuntoDia>();
  for (let d = inicio; d <= fin; d = sumarDias(d, 1)) {
    puntos.set(claveDia(d), { dia: claveDia(d), fecha: d, ingresos: 0, ventas: 0 });
  }
  for (const v of ventas) {
    const p = puntos.get(claveDia(new Date(v.fecha)));
    if (p) { p.ingresos += v.total; p.ventas += 1; }
  }
  return [...puntos.values()];
};

const conPorcentaje = (filas: Omit<Barra, 'pct'>[]): Barra[] => {
  const max = Math.max(0, ...filas.map((f) => f.ingresos));
  return filas.map((f) => ({ ...f, pct: max ? (f.ingresos / max) * 100 : 0 }));
};

export const topProductos = (ventas: Venta[], limite = 6): Barra[] => {
  const mapa = new Map<string, Omit<Barra, 'pct'>>();
  for (const v of ventas) {
    for (const l of v.detalle) {
      const f = mapa.get(l.productoId) ?? { clave: l.productoId, etiqueta: l.nombre, ingresos: 0, unidades: 0, ventas: 0 };
      f.ingresos += l.cantidad * l.precio;
      f.unidades += l.cantidad;
      f.ventas += 1;
      mapa.set(l.productoId, f);
    }
  }
  return conPorcentaje([...mapa.values()].sort((a, b) => b.ingresos - a.ingresos).slice(0, limite));
};

export const porVendedor = (ventas: Venta[], limite = 6): Barra[] => {
  const mapa = new Map<string, Omit<Barra, 'pct'>>();
  for (const v of ventas) {
    const f = mapa.get(v.usuario) ?? { clave: v.usuario, etiqueta: v.usuario, ingresos: 0, unidades: 0, ventas: 0 };
    f.ingresos += v.total;
    f.unidades += v.detalle.reduce((u, l) => u + l.cantidad, 0);
    f.ventas += 1;
    mapa.set(v.usuario, f);
  }
  return conPorcentaje([...mapa.values()].sort((a, b) => b.ingresos - a.ingresos).slice(0, limite));
};

// Siempre los tres metodos, en el mismo orden: el color sigue a la entidad, no a su posicion
export const porMetodo = (ventas: Venta[]): PorMetodo[] => {
  const total = ventas.reduce((t, v) => t + v.total, 0);
  return METODOS_PAGO.map((m) => {
    const propias = ventas.filter((v) => v.metodoPago === m.id);
    const ingresos = propias.reduce((t, v) => t + v.total, 0);
    return { id: m.id, etiqueta: m.etiqueta, ingresos, ventas: propias.length, pct: total ? (ingresos / total) * 100 : 0 };
  });
};

// Escala "bonita" para el eje Y: pasos de 1, 2, 2.5, 5 x 10^n
export const escala = (max: number, marcas = 4): { tope: number; marcas: number[] } => {
  if (max <= 0) return { tope: 1000, marcas: [0, 500, 1000] };
  const bruto = max / marcas;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / magnitud;
  const paso = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * magnitud;
  const tope = Math.ceil(max / paso - 1e-9) * paso;
  const lista: number[] = [];
  for (let v = 0; v <= tope + paso / 1000; v += paso) lista.push(Math.round(v * 100) / 100);
  return { tope, marcas: lista };
};
