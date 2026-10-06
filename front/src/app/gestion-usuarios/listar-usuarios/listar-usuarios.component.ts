import { Component, inject, signal } from '@angular/core';
import { ROLES, Rol } from '../../core/models';
import { Store } from '../../core/store';
import { GestionUsuariosService } from '../gestion-usuarios.service';
import { Usuario } from '../Interfaces/usuario.interface';

@Component({
  selector: 'app-listar-usuarios',
  standalone: false,
  templateUrl: './listar-usuarios.component.html',
  styleUrl: './listar-usuarios.component.css',
})
export class ListarUsuariosComponent {
  protected readonly store = inject(Store);
  private readonly servicio = inject(GestionUsuariosService);

  protected readonly panel = signal(false);
  protected readonly editando = signal<Usuario | null>(null);

  constructor() { this.servicio.cargarUsuarios(); }

  protected etiqueta(r: Rol) { return ROLES.find((x) => x.id === r)?.etiqueta ?? r; }

  protected nuevo() {
    this.editando.set(null);
    this.panel.set(true);
  }

  protected editar(u: Usuario) {
    this.editando.set(u);
    this.panel.set(true);
  }

  protected cerrar() {
    this.panel.set(false);
    this.editando.set(null);
  }

  protected async eliminar(u: Usuario) {
    if (!confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`)) return;
    const r = await this.servicio.eliminarUsuario(u.id);
    if (!r.ok) return this.store.avisar(r.error, 'error');
    if (this.editando()?.id === u.id) this.cerrar();
    this.store.avisar(`Usuario ${u.nombre} eliminado.`);
  }
}
