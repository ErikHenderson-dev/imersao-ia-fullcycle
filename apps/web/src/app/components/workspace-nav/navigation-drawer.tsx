"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import {
  useProfilePanelActions,
  useProfilePanelPerson,
} from "@/app/components/profile/profile-panel-provider";
import { IconButton } from "@/app/components/ui/icon-button";

type NavigationDrawerProps = {
  // O Rail e a barra lateral, renderizados no servidor.
  navigation: React.ReactNode;
  children: React.ReactNode;
};

// Navegação do shell (design system, "Layout e responsividade"): em md ou mais, o Rail e a barra
// lateral ficam em linha; abaixo de md, entram numa gaveta (Dialog do Radix) aberta pelo
// OpenNavigationButton. O Root envolve o shell, para os botões da página serem o gatilho dela e o
// foco voltar a eles quando a gaveta fecha pelo Esc ou pelo clique fora.
export function NavigationDrawer({ navigation, children }: NavigationDrawerProps) {
  const pathname = usePathname();
  // A gaveta fica presa à rota em que abriu: qualquer navegação a fecha (escolher um Canal, voltar
  // no navegador), e um Ctrl+clique, que abre outra aba, não.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const [closedByNavigation, setClosedByNavigation] = useState(false);
  if (openedAt !== null && openedAt !== pathname) {
    setOpenedAt(null);
    setClosedByNavigation(true);
  }
  // Abrir um Perfil de dentro da gaveta (o menu do avatar) também a fecha, e o foco fica no painel.
  const profilePersonId = useProfilePanelPerson();
  const { focusPanel } = useProfilePanelActions();
  const [shownProfile, setShownProfile] = useState(profilePersonId);
  if (shownProfile !== profilePersonId) {
    setShownProfile(profilePersonId);
    if (profilePersonId !== null && openedAt !== null) setOpenedAt(null);
  }

  // Em md ou mais, a navegação está em linha: a gaveta fecha, para o modal não travar a página.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (wide.matches) setOpenedAt(null);
    };
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  return (
    <Dialog.Root
      open={openedAt === pathname}
      onOpenChange={(open) => {
        setClosedByNavigation(false);
        setOpenedAt(open ? pathname : null);
      }}
    >
      <div className="hidden shrink-0 md:flex">{navigation}</div>
      {children}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 animate-fade-in bg-surface-overlay md:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          // Fechada por uma navegação, o botão que a abriu já saiu com a página antiga: o foco vai
          // para a caixa de mensagem da página nova, se houver.
          onCloseAutoFocus={(event) => {
            if (profilePersonId !== null) {
              event.preventDefault();
              focusPanel();
              return;
            }
            if (!closedByNavigation) return;
            event.preventDefault();
            document.querySelector<HTMLElement>("main textarea:not([disabled])")?.focus();
          }}
          className="fixed inset-y-0 left-0 z-40 flex max-w-full animate-fade-in shadow-3 outline-none md:hidden"
        >
          <Dialog.Title className="sr-only">Navegação</Dialog.Title>
          {navigation}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// "Abrir navegação" (ConversationHeader, Menu): só abaixo de md, onde o Rail e a barra lateral
// estão na gaveta.
export function OpenNavigationButton() {
  return (
    <Dialog.Trigger asChild>
      <IconButton icon={Menu} label="Abrir navegação" className="md:hidden" />
    </Dialog.Trigger>
  );
}
