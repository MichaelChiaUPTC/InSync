import { environment } from '../../environments/environment';

// Aplica los colores del tenant sobre las variables CSS globales.
export const aplicarTema = () => {
  const t = environment.theme;
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
  const raiz = document.documentElement;
  for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.deepColor);
};
