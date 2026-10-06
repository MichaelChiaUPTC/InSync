import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Icon } from '../shared/icon';
import { DashboardVentasComponent } from './dashboard-ventas/dashboard-ventas.component';
import { EstadisticasVentasRoutingModule } from './estadisticas-ventas-routing.module';

@NgModule({
  declarations: [DashboardVentasComponent],
  imports: [CommonModule, EstadisticasVentasRoutingModule, Icon],
})
export class EstadisticasVentasModule {}
