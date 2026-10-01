import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROLES } from '../core/models';
import { Store } from '../core/store';
import { Icon } from '../shared/icon';
import { Marca } from '../shared/marca';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Marca],
  template: `
    <div class="shell">
      <aside class="lateral">
        <div class="marca"><app-marca [size]="30" /><span>InSync</span></div>

        <div class="empresa" aria-label="Empresa activa">
          <app-icon name="building" [size]="18" />
          <span><strong>{{ store.tenant()?.nombre }}</strong><small>Instancia :{{ store.tenant()?.puerto }}</small></span>
        </div>

        <nav aria-label="Principal">
          @for (e of enlaces(); track e.ruta) {
            <a [routerLink]="e.ruta" routerLinkActive="activo"><app-icon [name]="e.icono" /> {{ e.texto }}</a>
          }
        </nav>

        <div class="usuario">
          <div class="quien">
            <strong>{{ store.sesion()?.nombre }}</strong>
            <small>{{ etiquetasRoles() }}</small>
          </div>
          <button type="button" class="salir" (click)="salir()" aria-label="Cerrar sesión" title="Cerrar sesión">
            <app-icon name="logout" />
          </button>
        </div>
      </aside>
      <main class="contenido"><router-outlet /></main>
    </div>
  `,
  styles: `
    .shell { display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 100dvh; }
    .lateral { position: sticky; top: 0; height: 100dvh; background: var(--color-deep); color: #fff; padding: 20px 16px; display: flex; flex-direction: column; gap: 20px; }
    .marca { display: flex; align-items: center; gap: 10px; font: 600 1.25rem var(--font-head); padding: 0 8px; }
    .empresa { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 10px; background: #ffffff1f; }
    .empresa span { display: grid; min-width: 0; }
    .empresa strong { font-weight: 600; line-height: 1.25; }
    small { color: #c3c6f0; font-size: 0.8125rem; }
    nav { display: grid; gap: 4px; flex: 1; align-content: start; }
    nav a { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px; border-radius: 8px; color: #e0e4fb; text-decoration: none; font-weight: 500; transition: background-color 200ms var(--ease), color 200ms var(--ease); }
    nav a:hover { background: #ffffff1a; color: #fff; }
    nav a.activo { background: var(--color-accent); color: #fff; font-weight: 600; }
    nav a:focus-visible, .salir:focus-visible { outline-color: #fff; }
    .usuario { display: flex; align-items: center; gap: 8px; padding-top: 16px; border-top: 1px solid #ffffff33; }
    .quien { display: grid; flex: 1; min-width: 0; }
    .quien strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .salir { display: grid; place-items: center; width: 40px; height: 40px; border: 0; border-radius: 8px; background: transparent; color: #fff; cursor: pointer; transition: background-color 200ms var(--ease); }
    .salir:hover { background: #ffffff26; }
    .contenido { min-width: 0; }
    @media (max-width: 900px) {
      .shell { grid-template-columns: minmax(0, 1fr); }
      .lateral { position: static; height: auto; flex-direction: row; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 16px; }
      .empresa { order: 3; flex: 1 1 100%; padding: 8px 12px; }
      nav { order: 4; flex: 1 1 100%; grid-auto-flow: column; grid-auto-columns: 1fr; overflow-x: auto; }
      nav a { justify-content: center; }
      .usuario { order: 2; margin-left: auto; border: 0; padding: 0; }
      .quien { display: none; }
    }
  `,
})
export class Shell {
  protected readonly store = inject(Store);
  private readonly router = inject(Router);

  protected readonly enlaces = computed(() => {
    this.store.sesion();
    const l = [{ ruta: '/inventario', texto: 'Inventario', icono: 'box' }];
    if (this.store.tieneRol('erp_ventas', 'erp_admin')) l.push({ ruta: '/ventas', texto: 'Ventas', icono: 'cart' });
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
