import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../shared/icon';
import { CrearUsuarioComponent } from './crear-usuario/crear-usuario.component';
import { GestionUsuariosRoutingModule } from './gestion-usuarios-routing.module';
import { ListarUsuariosComponent } from './listar-usuarios/listar-usuarios.component';

@NgModule({
  declarations: [ListarUsuariosComponent, CrearUsuarioComponent],
  imports: [CommonModule, GestionUsuariosRoutingModule, Icon],
})
export class GestionUsuariosModule {}
