import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GestionUsuariosModule } from '../gestion-usuarios.module';
import { CrearUsuarioComponent } from './crear-usuario.component';

describe('CrearUsuarioComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [GestionUsuariosModule],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }));

  it('se crea', () => {
    const fixture = TestBed.createComponent(CrearUsuarioComponent);

    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
