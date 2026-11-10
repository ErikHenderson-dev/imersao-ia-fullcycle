"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { saveTheme } from "@/app/actions/save-theme";
import { writeClientCookie } from "@/app/utils/client-cookies";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { THEME_CHANNEL, THEME_COOKIE, applyTheme, type Theme } from "@/app/utils/theme";

type ThemeContextValue = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);

// O tema das telas logadas, num lugar só (spec da F09, "Cliente", "Tema"): os botões de tema, no Rail
// e na cópia dele dentro da gaveta, só o leem e o trocam. `personTheme` é o tema gravado na Pessoa.
export function ThemeProvider({
  personTheme,
  children,
}: {
  personTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(personTheme);
  const [seenPersonTheme, setSeenPersonTheme] = useState(personTheme);
  const channel = useRef<BroadcastChannel | null>(null);
  // Só a troca mais recente pode voltar atrás: com dois cliques e duas falhas, a primeira volta
  // não desfaz a segunda.
  const latestToggle = useRef(0);

  // O tema da Pessoa chegou de novo, diferente (a renderização das telas logadas depois de trocar
  // em outro navegador): o estado o segue.
  if (seenPersonTheme !== personTheme) {
    setSeenPersonTheme(personTheme);
    setTheme(personTheme);
  }

  // A página e o cookie seguem a Pessoa, antes da pintura: entrar navega sem recarregar o layout
  // raiz, e o script do <head> não roda de novo.
  useLayoutEffect(() => {
    writeClientCookie(THEME_COOKIE, personTheme);
    applyTheme(personTheme);
  }, [personTheme]);

  // As outras abas do navegador trocam junto.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const current = new BroadcastChannel(THEME_CHANNEL);
    channel.current = current;
    current.onmessage = (event: MessageEvent<Theme>) => {
      applyTheme(event.data);
      setTheme(event.data);
    };
    return () => {
      current.close();
      channel.current = null;
    };
  }, []);

  const show = useCallback((next: Theme) => {
    applyTheme(next);
    writeClientCookie(THEME_COOKIE, next);
    setTheme(next);
    channel.current?.postMessage(next);
  }, []);

  // Aplica na hora e volta ao anterior se a gravação falhar.
  const toggle = useCallback(() => {
    const previous = theme;
    const next: Theme = previous === "light" ? "dark" : "light";
    const toggleId = ++latestToggle.current;
    show(next);
    void saveTheme(next)
      .catch(() => ({ kind: "failure" }) as const)
      .then((result) => {
        if (result.kind === "ok") return;
        if (result.kind === "unauthenticated") return redirectToExpiredSession();
        if (toggleId === latestToggle.current) show(previous);
        toast.error("Não foi possível trocar o tema");
      });
  }, [theme, show]);

  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme fora do ThemeProvider");
  return value;
}
