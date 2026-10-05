import { Injectable, computed, signal } from '@angular/core';
import { Producto } from '../gestion-inventarios/Interfaces/producto.interface';
import { Usuario } from '../gestion-usuarios/Interfaces/usuario.interface';
import { Venta } from '../gestion-ventas/Interfaces/venta.interface';
import { Rol, Sesion, Tenant } from './models';
import { aplicarTema } from './tema';

export const TENANTS: Tenant[] = [
  { id: 'A', nombre: 'Supermercado El Ahorro', actividad: 'Supermercado y abarrotes', puerto: 5000 },
  { id: 'B', nombre: 'Pastelería Dulce Aroma', actividad: 'Pastelería y panadería', puerto: 5001 },
];

const CLAVE = 'insync.sesion';

@Injectable({ providedIn: 'root' })
export class Store {
  readonly tenants = TENANTS;

  readonly sesion = signal<Sesion | null>(this.leerSesion());
  // Base de todas las peticiones: la API del negocio con sesion iniciada
  readonly apiUrl = computed(() => this.sesion()?.apiUrl ?? '');
  readonly tenant = computed(() => TENANTS.find((t) => t.id === this.sesion()?.tenant) ?? null);

  readonly productos = signal<Producto[]>([]);
  readonly ventas = signal<Venta[]>([]);
  readonly usuarios = signal<Usuario[]>([]);

  readonly avisos = signal<{ id: number; texto: string; tipo: 'ok' | 'error' }[]>([]);
  private avisoId = 0;

  constructor() {
    // Sesion restaurada al recargar: vuelve a aplicar el tema de su negocio
    aplicarTema(this.sesion()?.tenant ?? null);
  }

  entrar(s: Sesion) {
    this.sesion.set(s);
    aplicarTema(s.tenant);
    try { sessionStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  }

  salir() {
    this.sesion.set(null);
    aplicarTema(null);
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
      if (s && (s.expiraEn <= Date.now() || !s.apiUrl)) {
        sessionStorage.removeItem(CLAVE);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }
}
