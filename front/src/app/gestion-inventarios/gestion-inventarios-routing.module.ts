import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListarProductosComponent } from './listar-productos/listar-productos.component';

const routes: Routes = [
  { path: '', component: ListarProductosComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GestionInventariosRoutingModule {}
