"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type ProfilePanelActions = {
  // Abre o Perfil, ou troca o do painel aberto. O foco volta a `returnFocusTo` ao fechar; sem ele,
  // ao que tinha o foco na abertura.
  openProfile: (personId: string, returnFocusTo?: HTMLElement | null) => void;
  closeProfile: () => void;
  // Põe o foco no painel aberto (o botão de fechar, que o painel registra aqui).
  focusPanel: () => void;
  panelFocusTarget: React.RefObject<HTMLButtonElement | null>;
};

// Duas partes: as ações não mudam, e quem só abre o Perfil (as linhas do histórico, os menus) não
// renderiza de novo quando o painel abre, fecha ou troca de Pessoa.
const ActionsContext = createContext<ProfilePanelActions | null>(null);
const PersonContext = createContext<string | null>(null);

// Guarda a Pessoa do painel de perfil no layout das telas logadas, sem mexer no endereço: o painel
// continua aberto ao trocar de Conversa (spec da F05, "Painel de perfil").
export function ProfilePanelProvider({ children }: { children: React.ReactNode }) {
  const [personId, setPersonId] = useState<string | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const isOpen = useRef(false);
  const panelFocusTarget = useRef<HTMLButtonElement | null>(null);

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

  const focusPanel = useCallback(() => panelFocusTarget.current?.focus(), []);

  const actions = useMemo(
    () => ({ openProfile, closeProfile, focusPanel, panelFocusTarget }),
    [openProfile, closeProfile, focusPanel],
  );
  return (
    <ActionsContext value={actions}>
      <PersonContext value={personId}>{children}</PersonContext>
    </ActionsContext>
  );
}

export function useProfilePanelActions(): ProfilePanelActions {
  const value = useContext(ActionsContext);
  if (!value) throw new Error("useProfilePanelActions fora do ProfilePanelProvider");
  return value;
}

// A Pessoa do painel aberto, ou null com ele fechado.
export function useProfilePanelPerson(): string | null {
  return useContext(PersonContext);
}

// Para abrir o Perfil de dentro de um diálogo ou menu do Radix, que, ao fechar, devolveria o foco
// ao próprio gatilho: o `onCloseAutoFocus` do overlay deixa o foco no painel.
export function useOpenProfileFromOverlay() {
  const { openProfile, focusPanel } = useProfilePanelActions();
  const opening = useRef(false);
  const open = useCallback(
    (personId: string, returnFocusTo: HTMLElement | null) => {
      opening.current = true;
      openProfile(personId, returnFocusTo);
    },
    [openProfile],
  );
  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      if (!opening.current) return;
      opening.current = false;
      event.preventDefault();
      focusPanel();
    },
    [focusPanel],
  );
  return { open, onCloseAutoFocus };
}
