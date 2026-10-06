import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROLES } from '../../core/models';
import { Store } from '../../core/store';
import { Icon } from '../../shared/icon';
import { Marca } from '../../shared/marca';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Marca],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly enlaces = computed(() => {
    this.store.sesion();
    const l = [{ ruta: '/inventario', texto: 'Inventario', icono: 'box' }];
    if (this.store.tieneRol('erp_ventas', 'erp_admin')) {
      l.push({ ruta: '/ventas', texto: 'Ventas', icono: 'cart' });
      l.push({ ruta: '/estadisticas', texto: 'Estadísticas', icono: 'chart' });
    }
    if (this.store.tieneRol('erp_admin')) l.push({ ruta: '/usuarios', texto: 'Usuarios', icono: 'users' });
    return l;
  });

  protected readonly etiquetasRoles = computed(() =>
    ROLES.filter((r) => this.store.sesion()?.roles.includes(r.id)).map((r) => r.etiqueta).join(' · '),
  );

  protected salir() {
    this.store.salir();
    this.router.navigateByUrl('/login');
  }
}
