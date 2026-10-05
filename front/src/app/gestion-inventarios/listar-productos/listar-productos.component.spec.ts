import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GestionInventariosModule } from '../gestion-inventarios.module';
import { ListarProductosComponent } from './listar-productos.component';

describe('ListarProductosComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [GestionInventariosModule],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));

  it('se crea', () => {
    const fixture = TestBed.createComponent(ListarProductosComponent);

    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
