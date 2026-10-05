import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarVentasComponent } from './listar-ventas/listar-ventas.component';

const routes: Routes = [
  { path: '', component: ListarVentasComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GestionVentasRoutingModule {}
