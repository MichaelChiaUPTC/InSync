import { Rol } from '../../core/models';

export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  email: string;
  roles: Rol[];
  activo: boolean;
}

// Forma que devuelve el backend
export interface UsuarioApi {
  id: string;
  username: string;
  email: string;
  nombre: string;
  roles: Rol[];
  activo: boolean;
}
