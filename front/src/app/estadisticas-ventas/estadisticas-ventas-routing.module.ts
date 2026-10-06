import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardVentasComponent } from './dashboard-ventas/dashboard-ventas.component';

const routes: Routes = [
  { path: '', component: DashboardVentasComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EstadisticasVentasRoutingModule {}
