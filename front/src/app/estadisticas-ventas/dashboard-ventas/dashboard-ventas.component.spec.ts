import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Store } from '../../core/store';
import { EstadisticasVentasModule } from '../estadisticas-ventas.module';
import { DashboardVentasComponent } from './dashboard-ventas.component';

const hoy = new Date().toISOString();
// La carga termina en microtareas despues del flush: se deja correr la cola antes de leer el DOM
const esperar = () => new Promise<void>((r) => setTimeout(r, 0));

describe('DashboardVentasComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EstadisticasVentasModule],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    TestBed.inject(Store).sesion.set({
      tenant: 'A', apiUrl: environment.apiUrls.A, nombre: 'Prueba', roles: ['erp_admin'],
      accessToken: 't', refreshToken: 'r', expiraEn: Date.now() + 60000,
    });
  });

  it('dibuja las graficas con las ventas del backend', async () => {
    const fixture = TestBed.createComponent(DashboardVentasComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(`${environment.apiUrls.A}/ventas`).flush([
      { id: 'v1', usuario: 'ana', fecha: hoy, total: 13500, metodo_pago: 'efectivo', lineas: [{ producto_id: 'p1', nombre: 'Arroz', cantidad: 3, precio_unitario: 4500 }] },
      { id: 'v2', usuario: 'luis', fecha: hoy, total: 9800, metodo_pago: 'tarjeta', lineas: [{ producto_id: 'p2', nombre: 'Aceite', cantidad: 1, precio_unitario: 9800 }] },
    ]);
    await esperar();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.kpi').length).toBe(4);
    expect(el.querySelector('svg path.linea') ?? el.querySelector('svg circle.punto')).toBeTruthy();
    expect(el.querySelectorAll('.barras .barra').length).toBe(4); // 2 productos + 2 vendedores
    expect(el.querySelectorAll('.apilada .sp').length).toBe(2);
    expect(el.textContent).toContain('Ingresos por día');
  });

  it('cambia a la vista de tablas', async () => {
    const fixture = TestBed.createComponent(DashboardVentasComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrls.A}/ventas`).flush([
      { id: 'v1', usuario: 'ana', fecha: hoy, total: 4500, metodo_pago: 'efectivo', lineas: [{ producto_id: 'p1', nombre: 'Arroz', cantidad: 1, precio_unitario: 4500 }] },
    ]);
    await esperar();
    fixture.detectChanges();

    const botones = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.seg button'));
    botones.find((b) => b.textContent?.trim() === 'Tablas')!.click();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('table').length).toBe(4);
    expect(el.querySelector('svg')).toBeNull();
  });

  it('muestra el estado vacio cuando no hay ventas', async () => {
    const fixture = TestBed.createComponent(DashboardVentasComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrls.A}/ventas`).flush([]);
    await esperar();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sin ventas en este periodo');
  });
});
