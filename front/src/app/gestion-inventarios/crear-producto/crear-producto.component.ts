import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Store } from '../../core/store';
import { GestionInventariosService } from '../gestion-inventarios.service';
import { Producto } from '../Interfaces/producto.interface';

@Component({
  selector: 'app-crear-producto',
  standalone: false,
  templateUrl: './crear-producto.component.html',
  styleUrl: './crear-producto.component.css',
})
export class CrearProductoComponent {
  private readonly store = inject(Store);
  private readonly servicio = inject(GestionInventariosService);

  readonly modo = input.required<'nuevo' | 'editar'>();
  readonly producto = input<Producto | null>(null);
  readonly cerrado = output<void>();

  protected readonly codigo = signal('');
  protected readonly nombre = signal('');
  protected readonly precio = signal('');
  protected readonly stock = signal('');
  protected readonly error = signal('');

  constructor() {
    // Rellena el formulario cada vez que cambia el modo o el producto elegido
    effect(() => {
      const modo = this.modo();
      const p = this.producto();
      untracked(() => {
        this.error.set('');
        if (modo === 'editar' && p) {
          this.codigo.set(p.codigo); this.nombre.set(p.nombre);
          this.precio.set(String(p.precio)); this.stock.set(String(p.stock));
        } else {
          this.codigo.set(''); this.nombre.set(''); this.precio.set(''); this.stock.set('0');
        }
      });
    });
  }

  protected async guardar(ev: Event) {
    ev.preventDefault();
    const precio = Number(this.precio());
    const stock = Number(this.stock());
    if (this.modo() === 'nuevo' && (!this.codigo().trim() || !this.nombre().trim())) {
      return this.error.set('Completa el código y el nombre del producto.');
    }
    if (!Number.isFinite(precio) || precio <= 0) return this.error.set('El precio debe ser mayor que cero.');
    if (!Number.isInteger(stock) || stock < 0) return this.error.set('El stock debe ser un número entero, cero o más.');

    if (this.modo() === 'nuevo') {
      const codigo = this.codigo().trim().toUpperCase();
      const r = await this.servicio.crearProducto({ codigo, nombre: this.nombre().trim(), precio, stock });
      if (!r.ok) return this.error.set(r.error);
      this.store.avisar(`Producto ${codigo} creado.`);
    } else {
      const r = await this.servicio.actualizarProducto(this.producto()!.id, precio, stock);
      if (!r.ok) return this.error.set(r.error);
      this.store.avisar(`${this.nombre()} actualizado.`);
    }
    this.cerrado.emit();
  }
}
