import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../shared/icon';
import { CrearProductoComponent } from './crear-producto/crear-producto.component';
import { GestionInventariosRoutingModule } from './gestion-inventarios-routing.module';
import { ListarProductosComponent } from './listar-productos/listar-productos.component';

@NgModule({
  declarations: [ListarProductosComponent, CrearProductoComponent],
  imports: [CommonModule, GestionInventariosRoutingModule, Icon],
})
export class GestionInventariosModule {}
