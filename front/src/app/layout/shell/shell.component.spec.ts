import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ShellComponent], providers: [provideRouter([])] }));

  it('se crea', () => {
    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
