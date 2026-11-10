"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ProfilePanelContextValue = {
  // A Pessoa do painel aberto, ou null com ele fechado.
  personId: string | null;
  // Abre o Perfil, ou troca o do painel aberto. O foco volta a `returnFocusTo` ao fechar; sem ele,
  // ao que tinha o foco na abertura.
  openProfile: (personId: string, returnFocusTo?: HTMLElement | null) => void;
  closeProfile: () => void;
};

const ProfilePanelContext = createContext<ProfilePanelContextValue | null>(null);

// Guarda a Pessoa do painel de perfil no layout das telas logadas, sem mexer no endereço: o painel
// continua aberto ao trocar de Conversa (spec da F05, "Painel de perfil").
export function ProfilePanelProvider({ children }: { children: React.ReactNode }) {
  const [personId, setPersonId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpen = useRef(false);

  const openProfile = useCallback((id: string, returnFocusTo?: HTMLElement | null) => {
    // Trocar de Perfil com o painel aberto mantém o destino do foco da primeira abertura.
    if (!isOpen.current) {
      returnFocus.current =
        returnFocusTo ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    }
    isOpen.current = true;
    setPersonId(id);
  }, []);

  const closeProfile = useCallback(() => {
    isOpen.current = false;
    setPersonId(null);
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus();
  }, []);

  const value = useMemo(
    () => ({ personId, openProfile, closeProfile }),
    [personId, openProfile, closeProfile],
  );
  return <ProfilePanelContext value={value}>{children}</ProfilePanelContext>;
}

export function useProfilePanel(): ProfilePanelContextValue {
  const value = useContext(ProfilePanelContext);
  if (!value) throw new Error("useProfilePanel fora do ProfilePanelProvider");
  return value;
}
