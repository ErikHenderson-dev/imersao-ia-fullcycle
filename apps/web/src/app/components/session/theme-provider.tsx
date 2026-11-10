"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
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
  const channel = useRef<BroadcastChannel | null>(null);

  // Na carga, a página e o cookie seguem a Pessoa, que pode ter trocado o tema em outro navegador.
  useEffect(() => {
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
    show(next);
    void saveTheme(next)
      .catch(() => ({ kind: "failure" }) as const)
      .then((result) => {
        if (result.kind === "ok") return;
        if (result.kind === "unauthenticated") return redirectToExpiredSession();
        show(previous);
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
