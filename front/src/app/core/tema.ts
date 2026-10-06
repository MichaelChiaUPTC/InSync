import { Tema } from '../../environments/entorno';
import { temaPasteleria } from '../../environments/environmentPasteleria';
import { temaTienda } from '../../environments/environmentTienda';
import { TenantId } from './models';

// Antes de entrar (login) no hay tema: se usan los colores por defecto de styles.css.
export const LOGO_DEFAULT = 'logos/logo-default.svg';

// Tenant A = tienda, tenant B = pastelería
export const TEMAS: Record<TenantId, Tema> = { A: temaTienda, B: temaPasteleria };

const VARIABLES = [
  '--color-primary', '--color-ring', '--color-primary-text', '--color-deep',
  '--color-secondary', '--color-accent', '--color-background', '--color-foreground',
  '--color-muted', '--color-muted-foreground', '--color-border', '--info-fg', '--info-bg',
];

// Aplica los colores del tenant sobre las variables CSS globales.
// Sin tenant (login) quita los overrides y vuelven los colores por defecto de styles.css.
export const aplicarTema = (tenant: TenantId | null) => {
  const raiz = document.documentElement;
  const t = tenant ? TEMAS[tenant] : null;

  if (!t) {
    VARIABLES.forEach((v) => raiz.style.removeProperty(v));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#312e81');
    return;
  }

  const vars: Record<string, string> = {
    '--color-primary': t.primaryColor,
    '--color-ring': t.primaryColor,
    '--color-primary-text': t.primaryTextColor,
    '--color-deep': t.deepColor,
    '--color-secondary': t.secondaryColor,
    '--color-accent': t.accentColor,
    '--color-background': t.backgroundColor,
    '--color-foreground': t.foregroundColor,
    '--color-muted': t.mutedColor,
    '--color-muted-foreground': t.mutedForegroundColor,
    '--color-border': t.borderColor,
    '--info-fg': t.primaryTextColor,
    '--info-bg': t.mutedColor,
  };
  for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.deepColor);
};
