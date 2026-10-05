import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../shared/icon';
import { CrearVentaComponent } from './crear-venta/crear-venta.component';
import { GestionVentasRoutingModule } from './gestion-ventas-routing.module';
import { ListarVentasComponent } from './listar-ventas/listar-ventas.component';

@NgModule({
  declarations: [ListarVentasComponent, CrearVentaComponent],
  imports: [CommonModule, GestionVentasRoutingModule, Icon],
})
export class GestionVentasModule {}
