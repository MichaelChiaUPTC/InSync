import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GestionInventariosModule } from '../gestion-inventarios.module';
import { CrearProductoComponent } from './crear-producto.component';

describe('CrearProductoComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [GestionInventariosModule],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));

  it('se crea', () => {
    const fixture = TestBed.createComponent(CrearProductoComponent);
    fixture.componentRef.setInput('modo', 'nuevo');
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
