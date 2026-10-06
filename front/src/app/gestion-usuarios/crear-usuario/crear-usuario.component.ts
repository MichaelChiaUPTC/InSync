import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ROLES, Rol } from '../../core/models';
import { Store } from '../../core/store';
import { GestionUsuariosService } from '../gestion-usuarios.service';
import { Usuario } from '../Interfaces/usuario.interface';

@Component({
  selector: 'app-crear-usuario',
  standalone: false,
  templateUrl: './crear-usuario.component.html',
  styleUrl: './crear-usuario.component.css',
})
export class CrearUsuarioComponent {
  private readonly store = inject(Store);
  private readonly servicio = inject(GestionUsuariosService);
  protected readonly roles = ROLES;

  // null = crear usuario nuevo; con valor = editar ese usuario
  readonly usuario = input<Usuario | null>(null);
  readonly cerrado = output<void>();

  protected readonly nombre = signal('');
  protected readonly email = signal('');
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly activo = signal(true);
  protected readonly sel = signal<Rol[]>(['erp_ventas']);
  protected readonly error = signal('');

  constructor() {
    // Rellena el formulario cada vez que cambia el usuario elegido
    effect(() => {
      const u = this.usuario();
      untracked(() => {
        this.error.set('');
        this.password.set('');
        if (u) {
          this.nombre.set(u.nombre); this.email.set(u.email); this.username.set(u.username);
          this.activo.set(u.activo); this.sel.set([...u.roles]);
        } else {
          this.nombre.set(''); this.email.set(''); this.username.set('');
          this.activo.set(true); this.sel.set(['erp_ventas']);
        }
      });
    });
  }

  protected alternar(r: Rol) {
    this.sel.update((l) => (l.includes(r) ? l.filter((x) => x !== r) : [...l, r]));
  }

  protected async guardar(ev: Event) {
    ev.preventDefault();
    const email = this.email().trim();
    const nombre = this.nombre().trim();
    if (nombre.split(/\s+/).filter(Boolean).length < 2) return this.error.set('Escribe nombre y apellido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return this.error.set('Escribe un correo válido, por ejemplo nombre@empresa.co.');
    if (!this.username().trim()) return this.error.set('Escribe el nombre de usuario.');
    if (this.sel().length === 0) return this.error.set('Asigna al menos un rol.');

    const actual = this.usuario();
    const password = this.password();
    if (!actual && !password) return this.error.set('Escribe una contraseña para el usuario.');
    const r = actual
      ? await this.servicio.actualizarUsuario(actual.id, { nombre, email, roles: this.sel(), activo: this.activo(), ...(password ? { password } : {}) })
      : await this.servicio.crearUsuario({ username: this.username().trim(), nombre, email, roles: this.sel(), password });
    if (!r.ok) return this.error.set(r.error);
    this.store.avisar(actual ? `Usuario ${nombre} actualizado.` : `Usuario ${nombre} creado.`);
    this.cerrado.emit();
  }
}
