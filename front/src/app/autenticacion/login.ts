import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { Auth } from '../core/auth';
import { Store, TENANTS } from '../core/store';
import { Icon } from '../shared/icon';
import { Marca } from '../shared/marca';

@Component({
  selector: 'app-login',
  imports: [Icon, Marca],
  template: `
    <main class="login">
      <section class="lado" aria-label="Sobre InSync">
        <div class="marca"><app-marca [size]="36" /><span>InSync</span></div>
        <div class="mensaje">
          <h1>Inventario y ventas de tu negocio, en sincronía.</h1>
          <ul>
            <li><app-icon name="box" /> Productos y existencias al día</li>
            <li><app-icon name="cart" /> Ventas que descuentan stock al instante</li>
            <li><app-icon name="users" /> Cada empresa opera en su propia instancia</li>
          </ul>
        </div>
        <p class="pie">{{ empresa.nombre }} · {{ empresa.actividad }}</p>
      </section>

      <section class="form-lado">
        <form (submit)="entrar($event)" novalidate>
          <div>
            <h2>Entrar a InSync</h2>
            <p class="muted">Ingresa con tu usuario y contraseña de {{ store.tenant()?.nombre ?? empresa.nombre }}.</p>
          </div>

          <div class="field">
            <label for="usuario">Usuario</label>
            <input id="usuario" class="input" autocomplete="username" [value]="usuario()" (input)="usuario.set($any($event.target).value)" />
          </div>

          <div class="field">
            <label for="clave">Contraseña</label>
            <input id="clave" class="input" type="password" autocomplete="current-password" [value]="clave()" (input)="clave.set($any($event.target).value)" />
          </div>

          @if (error()) { <p class="form-error" role="alert">{{ error() }}</p> }
          <button class="btn btn-primary" type="submit" [disabled]="cargando()">{{ cargando() ? 'Entrando…' : 'Entrar' }}</button>
        </form>
      </section>
    </main>
  `,
  styles: `
    .login { min-height: 100dvh; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); }
    .lado { background: var(--color-deep); color: #fff; padding: 48px; display: flex; flex-direction: column; justify-content: space-between; gap: 48px; }
    .marca { display: flex; align-items: center; gap: 12px; font: 600 1.5rem var(--font-head); }
    .mensaje h1 { color: #fff; font-size: clamp(1.75rem, 3.2vw, 2.75rem); font-weight: 600; line-height: 1.15; max-width: 16ch; }
    .mensaje ul { list-style: none; margin: 40px 0 0; padding: 0; display: grid; gap: 0; max-width: 420px; }
    .mensaje li { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-top: 1px solid #ffffff33; color: #e0e4fb; }
    .pie { color: #c3c6f0; font-size: 0.875rem; }
    .form-lado { display: grid; place-items: center; padding: 32px 24px; }
    form { width: min(460px, 100%); display: grid; gap: 24px; }
    .btn { width: 100%; }
    @media (max-width: 860px) {
      .login { grid-template-columns: minmax(0, 1fr); }
      .lado { padding: 24px; gap: 24px; }
      .mensaje ul, .pie { display: none; }
      .mensaje h1 { font-size: 1.5rem; max-width: none; }
    }
  `,
})
export class Login {
  protected readonly store = inject(Store);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  protected readonly empresa = TENANTS.find((t) => t.id === environment.tenant)!;
  protected readonly usuario = signal('');
  protected readonly clave = signal('');
  protected readonly error = signal('');
  protected readonly cargando = signal(false);

  protected entrar(ev: Event) {
    ev.preventDefault();
    if (!this.usuario().trim() || !this.clave()) {
      this.error.set('Escribe tu usuario y tu contraseña.');
      return;
    }
    this.error.set('');
    this.cargando.set(true);
    this.auth.login(this.usuario().trim(), this.clave()).subscribe({
      next: (sesion) => {
        this.cargando.set(false);
        if (sesion.roles.length === 0) {
          this.error.set('Tu usuario no tiene roles asignados. Pídele al administrador que te asigne uno.');
          return;
        }
        this.store.entrar(sesion);
        this.router.navigateByUrl('/');
      },
      error: (e: Error) => {
        this.cargando.set(false);
        this.error.set(e.message);
      },
    });
  }
}
