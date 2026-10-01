import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { Api } from './core/api';
import { Store } from './core/store';

describe('Api', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('carga los productos desde el backend', async () => {
    const api = TestBed.inject(Api);
    const store = TestBed.inject(Store);
    const http = TestBed.inject(HttpTestingController);
    const carga = api.cargarProductos();
    http.expectOne((r) => r.url === `${environment.apiUrl}/productos`).flush([
      { id: 'p-01', sku: 'ARR-01', nombre: 'Arroz Diana 1kg', precio_venta: 4500, stock_actual: 100 },
    ]);
    await carga;
    expect(store.productos()).toEqual([{ id: 'p-01', codigo: 'ARR-01', nombre: 'Arroz Diana 1kg', precio: 4500, stock: 100 }]);
  });

  it('muestra el error del backend cuando el código de producto se repite', async () => {
    const api = TestBed.inject(Api);
    const http = TestBed.inject(HttpTestingController);
    const crear = api.crearProducto({ codigo: 'ARR-01', nombre: 'Otro', precio: 1000, stock: 1 });
    http.expectOne(`${environment.apiUrl}/productos`).flush({ mensaje: 'El código ARR-01 ya existe' }, { status: 409, statusText: 'Conflict' });
    const r = await crear;
    expect(r).toEqual({ ok: false, error: 'El código ARR-01 ya existe' });
  });
});
