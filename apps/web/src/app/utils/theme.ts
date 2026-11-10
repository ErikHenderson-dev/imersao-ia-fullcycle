// O tema claro ou escuro (spec da F09, "Cliente", "Tema"). A escolha fica na Pessoa, e o cookie
// `theme` a espelha no navegador para a primeira pintura (LLD, "Cliente", "Cookies do cliente").
export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

// O canal pelo qual a aba que troca o tema avisa as outras do mesmo navegador.
export const THEME_CHANNEL = "theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

// Aplica o tema no <html>: o atributo dos tokens e o color-scheme dos controles nativos.
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

// Volta ao claro, o padrão sem o atributo: "Entrar" e as telas sem Sessão.
export function clearTheme(): void {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  root.style.colorScheme = "";
}

// O script bloqueante do <head>: aplica o tema do cookie antes da pintura, sem esperar a
// hidratação. "Entrar" fica no claro.
export const THEME_SCRIPT = `(function(){try{var p=location.pathname;if(p==="/entrar"||p.indexOf("/entrar/")===0)return;var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)(?:;|$)/);var t=m?m[1]:"light";var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t;}catch(e){}})();`;
