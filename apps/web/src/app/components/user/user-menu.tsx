"use client";

import { CircleUser, LogOut } from "lucide-react";
import { useRef, useTransition } from "react";
import { logout } from "@/app/actions/logout";
import { focusProfilePanel } from "@/app/components/profile/profile-panel";
import { useProfilePanel } from "@/app/components/profile/profile-panel-provider";
import { Avatar } from "@/app/components/ui/avatar";
import { Spinner } from "@/app/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import type { Person } from "@/app/services/chat-api";
import { markLeaving } from "@/app/utils/leaving";

type UserMenuProps = { person: Person };

// Menu do avatar do Rail: o cabeçalho, sem a linha de presença, "Perfil" (F05) e "Sair do Full
// Cycle". "Editar perfil" e a presença entram com a F09.
export function UserMenu({ person }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();
  const { openProfile } = useProfilePanel();
  const trigger = useRef<HTMLButtonElement>(null);
  // O menu devolve o foco ao avatar ao fechar; abrindo o Perfil, o foco fica no painel.
  const openingProfile = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger ref={trigger} className="rounded-item" title={person.name}>
        <Avatar initials={person.initials} seed={person.id} />
        <span className="sr-only">Menu de {person.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        className="w-72"
        onCloseAutoFocus={(event) => {
          if (!openingProfile.current) return;
          openingProfile.current = false;
          event.preventDefault();
          focusProfilePanel();
        }}
      >
        <div className="flex items-center gap-3 px-4 pt-1 pb-2">
          <Avatar initials={person.initials} seed={person.id} />
          <p className="min-w-0 flex-1 truncate text-body font-black text-fg">
            {person.name}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            openingProfile.current = true;
            openProfile(person.id, trigger.current);
          }}
        >
          <CircleUser size={16} aria-hidden />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isPending}
          onSelect={(event) => {
            // O menu fica aberto, com o item desabilitado, até a saída terminar: sem um segundo
            // clique enquanto a API responde.
            event.preventDefault();
            markLeaving();
            startTransition(() => logout());
          }}
        >
          {/* Carregando: spinner no lugar do ícone, texto mantido (design system). */}
          {isPending ? <Spinner size="sm" /> : <LogOut size={16} aria-hidden />}
          Sair do Full Cycle
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
