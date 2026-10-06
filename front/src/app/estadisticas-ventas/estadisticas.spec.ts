import { Venta } from '../gestion-ventas/Interfaces/venta.interface';
import { escala, filtrarPorRango, porMetodo, resumen, topProductos, ventasPorDia } from './estadisticas';

const venta = (id: string, fecha: string, usuario: string, metodoPago: Venta['metodoPago'], lineas: [string, number, number][]): Venta => ({
  id, usuario, fecha, metodoPago,
  total: lineas.reduce((t, [, c, p]) => t + c * p, 0),
  detalle: lineas.map(([nombre, cantidad, precio]) => ({ productoId: nombre, nombre, cantidad, precio })),
});

// Mediodia local para que la zona horaria de quien corre el test no cambie el dia
const AHORA = new Date(2026, 9, 5, 12, 0, 0);
const dia = (d: number, h = 10) => new Date(2026, 9, d, h, 0, 0).toISOString();

const VENTAS: Venta[] = [
  venta('1', dia(5), 'ana', 'efectivo', [['Arroz', 2, 4500], ['Aceite', 1, 9800]]),
  venta('2', dia(5, 15), 'luis', 'tarjeta', [['Arroz', 1, 4500]]),
  venta('3', dia(3), 'ana', 'efectivo', [['Cafe', 1, 14500]]),
  venta('4', dia(1), 'ana', 'transferencia', [['Leche', 6, 3900]]),
];

describe('estadisticas de ventas', () => {
  it('resume ingresos, ventas, ticket y unidades', () => {
    expect(resumen(VENTAS)).toEqual({ ingresos: 18800 + 4500 + 14500 + 23400, ventas: 4, ticket: 61200 / 4, unidades: 11 });
    expect(resumen([])).toEqual({ ingresos: 0, ventas: 0, ticket: 0, unidades: 0 });
  });

  it('filtra por rango contando hoy', () => {
    expect(filtrarPorRango(VENTAS, 1, AHORA).map((v) => v.id)).toEqual(['1', '2']);
    expect(filtrarPorRango(VENTAS, 3, AHORA).map((v) => v.id)).toEqual(['1', '2', '3']);
    expect(filtrarPorRango(VENTAS, null, AHORA)).toHaveLength(4);
  });

  it('agrupa por dia y rellena con cero los dias sin ventas', () => {
    const serie = ventasPorDia(filtrarPorRango(VENTAS, 5, AHORA), 5, AHORA);
    expect(serie.map((p) => p.dia)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
    expect(serie.map((p) => p.ingresos)).toEqual([23400, 0, 14500, 0, 23300]);
    expect(serie[4].ventas).toBe(2);
  });

  it('con "todo" arranca el primer dia con ventas', () => {
    const serie = ventasPorDia(VENTAS, null, AHORA);
    expect(serie[0].dia).toBe('2026-10-01');
    expect(serie).toHaveLength(5);
    expect(ventasPorDia([], null, AHORA)).toEqual([]);
  });

  it('ordena los productos por ingresos y escala las barras al maximo', () => {
    const top = topProductos(VENTAS, 2);
    expect(top.map((p) => p.etiqueta)).toEqual(['Leche', 'Cafe']);
    expect(top[0].pct).toBe(100);
    expect(top[1].ingresos).toBe(14500);
    expect(topProductos(VENTAS).find((p) => p.etiqueta === 'Arroz')).toMatchObject({ ingresos: 13500, unidades: 3 });
  });

  it('reparte por metodo de pago siempre en el mismo orden', () => {
    const pagos = porMetodo(VENTAS);
    expect(pagos.map((p) => p.id)).toEqual(['efectivo', 'tarjeta', 'transferencia']);
    expect(pagos.reduce((t, p) => t + p.pct, 0)).toBeCloseTo(100);
    expect(porMetodo([]).every((p) => p.pct === 0)).toBe(true);
  });

  it('escala del eje con numeros redondos', () => {
    expect(escala(0).marcas).toEqual([0, 500, 1000]);
    const e = escala(23400);
    expect(e.tope).toBeGreaterThanOrEqual(23400);
    expect(e.marcas[0]).toBe(0);
    expect(e.marcas.at(-1)).toBe(e.tope);
    expect(escala(1_234_567).marcas.every((m) => m % 250_000 === 0)).toBe(true);
  });
});
