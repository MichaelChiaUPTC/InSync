import { Component, input } from '@angular/core';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-marca',
  template: `<img [src]="logo" [attr.width]="size()" [attr.height]="size()" alt="" />`,
  styles: `:host { display: inline-flex; } img { display: block; border-radius: 8px; }`,
})
export class Marca {
  readonly size = input(32);
  protected readonly logo = environment.theme.logo;
}
