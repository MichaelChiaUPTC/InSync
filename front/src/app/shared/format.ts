const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

export const formatoCOP = (n: number) => cop.format(n);
export const formatoFecha = (iso: string) => fecha.format(new Date(iso));
