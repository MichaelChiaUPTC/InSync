import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GestionUsuariosModule } from '../gestion-usuarios.module';
import { ListarUsuariosComponent } from './listar-usuarios.component';

describe('ListarUsuariosComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [GestionUsuariosModule],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));

  it('se crea', () => {
    const fixture = TestBed.createComponent(ListarUsuariosComponent);

    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
