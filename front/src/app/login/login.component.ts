import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../core/auth';
import { Store } from '../core/store';
import { Icon } from '../shared/icon';
import { Marca } from '../shared/marca';

@Component({
  selector: 'app-login',
  imports: [Icon, Marca],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly store = inject(Store);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

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
