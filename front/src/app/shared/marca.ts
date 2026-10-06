import { Component, computed, inject, input } from '@angular/core';
import { Store } from '../core/store';
import { LOGO_DEFAULT, TEMAS } from '../core/tema';

@Component({
  selector: 'app-marca',
  template: `<img [src]="logo()" [attr.width]="size()" [attr.height]="size()" alt="" />`,
  styles: `:host { display: inline-flex; } img { display: block; border-radius: 8px; }`,
})
export class Marca {
  private readonly store = inject(Store);
  readonly size = input(32);
  // Logo del negocio una vez dentro; logo neutro en el login
  protected readonly logo = computed(() => {
    const tenant = this.store.sesion()?.tenant;
    return tenant ? TEMAS[tenant].logo : LOGO_DEFAULT;
  });
}
