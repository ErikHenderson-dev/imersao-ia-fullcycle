"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/components/session/theme-provider";
import { IconButton } from "@/app/components/ui/icon-button";

// ThemeToggle (design system, Features e widgets): a lua no tema claro e o sol no escuro, no Rail,
// acima do avatar (spec da F09, "Cliente", "Tema"). O tema fica no ThemeProvider.
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <IconButton
      icon={theme === "light" ? Moon : Sun}
      label={theme === "light" ? "Mudar para o tema escuro" : "Mudar para o tema claro"}
      tone="sidebar"
      onClick={toggle}
    />
  );
}
