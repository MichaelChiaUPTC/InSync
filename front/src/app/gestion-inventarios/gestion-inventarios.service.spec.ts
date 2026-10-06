import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Store } from '../core/store';
import { GestionInventariosService } from './gestion-inventarios.service';

describe('GestionInventariosService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(Store).sesion.set({
      tenant: 'A', apiUrl: environment.apiUrls.A, nombre: 'Prueba', roles: ['erp_admin'],
      accessToken: 't', refreshToken: 'r', expiraEn: Date.now() + 60000,
    });
  });

  it('carga los productos desde el backend', async () => {
    const servicio = TestBed.inject(GestionInventariosService);
    const store = TestBed.inject(Store);
    const http = TestBed.inject(HttpTestingController);
    const carga = servicio.cargarProductos();
    http.expectOne((r) => r.url === `${environment.apiUrls.A}/productos`).flush([
      { id: 'p-01', sku: 'ARR-01', nombre: 'Arroz Diana 1kg', precio_venta: 4500, stock_actual: 100 },
    ]);
    await carga;
    expect(store.productos()).toEqual([{ id: 'p-01', codigo: 'ARR-01', nombre: 'Arroz Diana 1kg', precio: 4500, stock: 100 }]);
  });

  it('muestra el error del backend cuando el código de producto se repite', async () => {
    const servicio = TestBed.inject(GestionInventariosService);
    const http = TestBed.inject(HttpTestingController);
    const crear = servicio.crearProducto({ codigo: 'ARR-01', nombre: 'Otro', precio: 1000, stock: 1 });
    http.expectOne(`${environment.apiUrls.A}/productos`).flush({ mensaje: 'El código ARR-01 ya existe' }, { status: 409, statusText: 'Conflict' });
    const r = await crear;
    expect(r).toEqual({ ok: false, error: 'El código ARR-01 ya existe' });
  });
});
