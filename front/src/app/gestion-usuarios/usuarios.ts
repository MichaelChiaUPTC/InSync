import { Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { ROLES, Rol, Usuario } from '../core/models';
import { Store } from '../core/store';
import { Icon } from '../shared/icon';

@Component({
  selector: 'app-usuarios',
  imports: [Icon],
  template: `
    <div class="page">
      <header class="page-head">
        <div>
          <h1>Usuarios</h1>
          <p>Personas con acceso a {{ store.tenant()?.nombre }} y sus roles.</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="abrir()"><app-icon name="plus" /> Nuevo usuario</button>
      </header>

      <div class="split" [class.open]="panel()">
        <div class="surface">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Roles</th><th><span class="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                @for (u of store.usuarios(); track u.id) {
                  <tr [class.sel]="editando()?.id === u.id">
                    <td><strong>{{ u.nombre }}</strong> @if (!u.activo) { <span class="pill bad">Inactivo</span> }</td>
                    <td class="muted">{{ u.username }}</td>
                    <td class="muted">{{ u.email }}</td>
                    <td class="roles">
                      @for (r of u.roles; track r) { <span class="pill info">{{ etiqueta(r) }}</span> }
                    </td>
                    <td class="actions">
                      <button type="button" class="btn btn-ghost btn-sm" (click)="editar(u)" [attr.aria-label]="'Editar ' + u.nombre"><app-icon name="pencil" [size]="16" /> Editar</button>
                      <button type="button" class="btn btn-ghost btn-sm" (click)="eliminar(u)" [attr.aria-label]="'Eliminar ' + u.nombre"><app-icon name="trash" [size]="16" /> Eliminar</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="pager">Usuarios de prueba: viven en la memoria del servidor y no pueden iniciar sesión. El acceso real se administra en Keycloak.</p>
        </div>

        @if (panel()) {
          <aside class="surface panel" [attr.aria-label]="editando() ? 'Editar usuario' : 'Nuevo usuario'">
            <div class="panel-head">
              <h2>{{ editando() ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
              <button type="button" class="btn btn-ghost btn-sm btn-icon" (click)="panel.set(false)" aria-label="Cerrar formulario"><app-icon name="x" [size]="18" /></button>
            </div>
            <form (submit)="guardar($event)" novalidate class="form">
              <div class="field">
                <label for="n">Nombre completo</label>
                <input id="n" class="input" autocomplete="off" [value]="nombre()" (input)="nombre.set($any($event.target).value)" />
              </div>
              <div class="field">
                <label for="u">Usuario</label>
                <input id="u" class="input" autocomplete="off" autocapitalize="none" [readOnly]="!!editando()" [value]="username()" (input)="username.set($any($event.target).value)" />
              </div>
              <div class="field">
                <label for="e">Correo</label>
                <input id="e" class="input" type="email" autocomplete="off" placeholder="nombre@empresa.co" [value]="email()" (input)="email.set($any($event.target).value)" />
              </div>
              <fieldset class="field">
                <legend class="label">Roles</legend>
                @for (r of roles; track r.id) {
                  <label class="check">
                    <input type="checkbox" [checked]="sel().includes(r.id)" (change)="alternar(r.id)" />
                    <span><strong>{{ r.etiqueta }}</strong> <small class="muted">{{ r.detalle }}</small></span>
                  </label>
                }
              </fieldset>
              @if (editando()) {
                <label class="check">
                  <input type="checkbox" [checked]="activo()" (change)="activo.set(!activo())" />
                  <span><strong>Usuario activo</strong></span>
                </label>
              }
              @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
              <div class="fila">
                <button type="submit" class="btn btn-primary">{{ editando() ? 'Guardar cambios' : 'Crear usuario' }}</button>
                <button type="button" class="btn btn-secondary" (click)="panel.set(false)">Cancelar</button>
              </div>
            </form>
          </aside>
        }
      </div>
    </div>
  `,
  styles: `
    .roles { display: flex; flex-wrap: wrap; gap: 6px; }
    .form { display: grid; gap: 16px; }
    fieldset { border: 0; padding: 0; margin: 0; }
    legend { padding: 0; margin-bottom: 6px; }
    .check { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; cursor: pointer; }
    .check input { width: 20px; height: 20px; margin: 2px 0 0; accent-color: var(--color-primary); flex: none; cursor: pointer; }
    .fila { display: flex; gap: 8px; flex-wrap: wrap; }
    aside { position: sticky; top: 24px; }
    .pager { border-top: 1px solid var(--color-border); font-size: 0.875rem; }
  `,
})
export class Usuarios {
  protected readonly store = inject(Store);
  private readonly api = inject(Api);
  protected readonly roles = ROLES;
  protected readonly panel = signal(false);
  protected readonly nombre = signal('');
  protected readonly email = signal('');
  protected readonly username = signal('');
  protected readonly activo = signal(true);
  protected readonly editando = signal<Usuario | null>(null);
  protected readonly sel = signal<Rol[]>(['erp_ventas']);
  protected readonly error = signal('');

  constructor() { this.api.cargarUsuarios(); }

  protected etiqueta(r: Rol) { return ROLES.find((x) => x.id === r)?.etiqueta ?? r; }

  protected abrir() {
    this.editando.set(null);
    this.nombre.set(''); this.email.set(''); this.username.set(''); this.activo.set(true);
    this.sel.set(['erp_ventas']); this.error.set('');
    this.panel.set(true);
  }

  protected editar(u: Usuario) {
    this.editando.set(u);
    this.nombre.set(u.nombre); this.email.set(u.email); this.username.set(u.username); this.activo.set(u.activo);
    this.sel.set([...u.roles]); this.error.set('');
    this.panel.set(true);
  }

  protected async eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    const r = await this.api.eliminarUsuario(u.id);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    if (this.editando()?.id === u.id) this.panel.set(false);
    this.store.avisar(`Usuario ${u.nombre} eliminado.`);
  }

  protected alternar(r: Rol) {
    this.sel.update((l) => (l.includes(r) ? l.filter((x) => x !== r) : [...l, r]));
  }

  protected async guardar(ev: Event) {
    ev.preventDefault();
    const email = this.email().trim();
    const nombre = this.nombre().trim();
    if (!nombre) return this.error.set('Escribe el nombre de la persona.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.error.set('Escribe un correo válido, por ejemplo nombre@empresa.co.');
    if (!this.username().trim()) return this.error.set('Escribe el nombre de usuario.');
    if (this.sel().length === 0) return this.error.set('Asigna al menos un rol.');

    const actual = this.editando();
    const r = actual
      ? await this.api.actualizarUsuario(actual.id, { nombre, email, roles: this.sel(), activo: this.activo() })
      : await this.api.crearUsuario({ username: this.username().trim(), nombre, email, roles: this.sel() });
    if (!r.ok) return this.error.set(r.error);
    this.store.avisar(actual ? `Usuario ${nombre} actualizado.` : `Usuario ${nombre} creado.`);
    this.panel.set(false);
  }
}
