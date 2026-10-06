import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GestionVentasModule } from '../gestion-ventas.module';
import { CrearVentaComponent } from './crear-venta.component';

describe('CrearVentaComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [GestionVentasModule],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));

  it('se crea', () => {
    const fixture = TestBed.createComponent(CrearVentaComponent);

    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
