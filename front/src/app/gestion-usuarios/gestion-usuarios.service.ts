import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Resultado } from '../core/models';
import { Store } from '../core/store';
import { mensajeError } from '../shared/http-error';
import { Usuario, UsuarioApi } from './Interfaces/usuario.interface';

const aUsuario = (u: UsuarioApi): Usuario => ({
  id: u.id,
  username: u.username,
  nombre: u.nombre,
  email: u.email,
  roles: u.roles,
  activo: u.activo,
});

@Injectable({ providedIn: 'root' })
export class GestionUsuariosService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);
  private get url() { return `${this.store.apiUrl()}/usuarios`; }

  async cargarUsuarios() {
    try {
      const lista = await firstValueFrom(this.http.get<UsuarioApi[]>(this.url));
      this.store.usuarios.set(lista.map(aUsuario));
    } catch (e) {
      this.store.avisar(mensajeError(e, 'No se pudieron cargar los usuarios.'), 'error');
    }
  }

  async crearUsuario(u: Omit<Usuario, 'id' | 'activo'> & { password: string }): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.post(this.url, u));
      await this.cargarUsuarios();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo crear el usuario.') };
    }
  }

  async actualizarUsuario(id: string, u: Pick<Usuario, 'nombre' | 'email' | 'roles' | 'activo'> & { password?: string }): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.put(`${this.url}/${id}`, u));
      await this.cargarUsuarios();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo actualizar el usuario.') };
    }
  }

  async eliminarUsuario(id: string): Promise<Resultado> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/${id}`));
      this.store.usuarios.update((l) => l.filter((x) => x.id !== id));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: mensajeError(e, 'No se pudo eliminar el usuario.') };
    }
  }
}
