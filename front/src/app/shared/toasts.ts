import { Component, inject } from '@angular/core';
import { Store } from '../core/store';
import { Icon } from './icon';

@Component({
  selector: 'app-toasts',
  imports: [Icon],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (a of store.avisos(); track a.id) {
        <div class="toast" [class.error]="a.tipo === 'error'">
          <app-icon [name]="a.tipo === 'error' ? 'alert' : 'check'" [size]="18" />
          <span>{{ a.texto }}</span>
          <button type="button" class="cerrar" (click)="store.cerrarAviso(a.id)" aria-label="Cerrar aviso">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; right: 16px; bottom: 16px; display: grid; gap: 8px; z-index: 50; max-width: min(380px, calc(100vw - 32px)); }
    .toast { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--color-deep); color: #fff; box-shadow: var(--shadow-lg); font-weight: 500; animation: entra 250ms var(--ease); }
    .toast.error { background: #7f1d1d; }
    .toast span { flex: 1; }
    .cerrar { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
    .cerrar:hover { background: #ffffff26; }
    @keyframes entra { from { opacity: 0; translate: 0 8px; } }
  `,
})
export class Toasts {
  protected readonly store = inject(Store);
}
