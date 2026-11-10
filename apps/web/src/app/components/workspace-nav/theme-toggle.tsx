"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveTheme } from "@/app/actions/save-theme";
import { IconButton } from "@/app/components/ui/icon-button";
import { readClientCookie, writeClientCookie } from "@/app/utils/client-cookies";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { THEME_CHANNEL, THEME_COOKIE, applyTheme, type Theme } from "@/app/utils/theme";

// ThemeToggle (design system, Features e widgets): a lua no tema claro e o sol no escuro, no Rail,
// acima do avatar (spec da F09, "Cliente", "Tema"). `personTheme` é o tema gravado na Pessoa.
export function ThemeToggle({ personTheme }: { personTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(personTheme);
  const [seenPersonTheme, setSeenPersonTheme] = useState(personTheme);
  const channel = useRef<BroadcastChannel | null>(null);

  // O tema da Pessoa mudou numa nova renderização do layout (trocado em outro navegador).
  if (seenPersonTheme !== personTheme) {
    setSeenPersonTheme(personTheme);
    setTheme(personTheme);
  }

  // A página e o cookie seguem a Pessoa, que pode ter trocado o tema em outro navegador.
  useEffect(() => {
    if (readClientCookie(THEME_COOKIE) !== personTheme) writeClientCookie(THEME_COOKIE, personTheme);
    applyTheme(personTheme);
  }, [personTheme]);

  // As outras abas do navegador trocam junto.
  useEffect(() => {
    if (typeof BroadcastChannel !== "function") return;
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

  function show(next: Theme) {
    applyTheme(next);
    writeClientCookie(THEME_COOKIE, next);
    setTheme(next);
    channel.current?.postMessage(next);
  }

  async function toggle() {
    const previous = theme;
    const next: Theme = previous === "light" ? "dark" : "light";
    show(next);
    const result = await saveTheme(next).catch(() => ({ kind: "failure" }) as const);
    if (result.kind === "ok") return;
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    show(previous);
    toast.error("Não foi possível trocar o tema");
  }

  return (
    <IconButton
      icon={theme === "light" ? Moon : Sun}
      label={theme === "light" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      tone="sidebar"
      onClick={() => void toggle()}
    />
  );
}
