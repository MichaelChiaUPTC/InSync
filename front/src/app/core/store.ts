import { Injectable, computed, signal } from '@angular/core';
import {
  Producto, Rol, Sesion, Tenant, Usuario, Venta,
} from './models';

export const TENANTS: Tenant[] = [
  { id: 'A', nombre: 'Supermercado El Ahorro', actividad: 'Supermercado y abarrotes', puerto: 5000 },
  { id: 'B', nombre: 'Pastelería Dulce Aroma', actividad: 'Pastelería y panadería', puerto: 5001 },
];

const CLAVE = 'insync.sesion';

@Injectable({ providedIn: 'root' })
export class Store {
  readonly tenants = TENANTS;

  readonly sesion = signal<Sesion | null>(this.leerSesion());
  readonly tenant = computed(() => TENANTS.find((t) => t.id === this.sesion()?.tenant) ?? null);

  readonly productos = signal<Producto[]>([]);
  readonly ventas = signal<Venta[]>([]);
  readonly usuarios = signal<Usuario[]>([]);

  readonly avisos = signal<{ id: number; texto: string; tipo: 'ok' | 'error' }[]>([]);
  private avisoId = 0;

  entrar(s: Sesion) {
    this.sesion.set(s);
    try { sessionStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  }

  salir() {
    this.sesion.set(null);
    this.productos.set([]);
    this.ventas.set([]);
    this.usuarios.set([]);
    try { sessionStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
  }

  tieneRol(...roles: Rol[]) {
    const mis = this.sesion()?.roles ?? [];
    return roles.some((r) => mis.includes(r));
  }

  avisar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    const id = ++this.avisoId;
    this.avisos.update((a) => [...a, { id, texto, tipo }]);
    setTimeout(() => this.cerrarAviso(id), 4000);
  }

  cerrarAviso(id: number) {
    this.avisos.update((a) => a.filter((x) => x.id !== id));
  }

  private leerSesion(): Sesion | null {
    try {
      const raw = sessionStorage.getItem(CLAVE);
      const s = raw ? (JSON.parse(raw) as Sesion) : null;
      if (s && s.expiraEn <= Date.now()) {
        sessionStorage.removeItem(CLAVE);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }
}
