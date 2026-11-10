"use client";

import { Bell, BellOff, CircleUser, LogOut, Pencil } from "lucide-react";
import { useRef, useTransition } from "react";
import { logout } from "@/app/actions/logout";
import { useEditProfile } from "@/app/components/profile/edit-profile-dialog";
import type { Presence } from "chat-events";
import { toast } from "sonner";
import { savePresenceChoice } from "@/app/actions/save-presence-choice";
import {
  useKnownPerson,
  useKnownPresence,
  usePeopleStore,
} from "@/app/components/people/people-provider";
import { PresenceDot, presenceLabel } from "@/app/components/ui/presence-dot";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { UserStatus } from "@/app/components/people/user-status";
import { useOpenProfileFromOverlay } from "@/app/components/profile/profile-panel-provider";
import { useBrowserNotifications } from "@/app/hooks/use-browser-notifications";
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

// Menu do avatar do Rail ("Casca / Menu do usuário"): o cabeçalho com a Presença, "Definir como
// ausente" ou "disponível" (F09), "Perfil" (F05), "Editar perfil" (F09), a opção da notificação do
// navegador (F08) e "Sair do Full Cycle".
export function UserMenu({ person: sessionPerson }: UserMenuProps) {
  // O nome atual, também depois de editado em outra aba (spec da F09, "Camada de Pessoas").
  const known = useKnownPerson(sessionPerson.id);
  const person = known ? { ...sessionPerson, name: known.name, initials: known.initials } : sessionPerson;
  const [isPending, startTransition] = useTransition();
  const profile = useOpenProfileFromOverlay();
  const trigger = useRef<HTMLButtonElement>(null);
  const browserNotifications = useBrowserNotifications();
  const { openEditProfile } = useEditProfile();
  // O diálogo abre depois de o menu fechar e devolver o foco ao avatar: abrir os dois ao mesmo tempo
  // deixaria o foco preso entre eles.
  const editingProfile = useRef(false);
  const people = usePeopleStore();
  // A própria Presença: com a aba aberta, é a escolha (spec da F09, "Escolha de presença").
  const presence = useKnownPresence(person.id, sessionPerson.presenceChoice) ?? "available";

  // Aplica a escolha na hora e volta à anterior se a gravação falhar.
  async function choosePresence(next: Presence) {
    const previous = presence;
    people.applyPresence(person.id, next);
    const result = await savePresenceChoice(next).catch(() => ({ kind: "failure" }) as const);
    if (result.kind === "ok") return;
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    people.applyPresence(person.id, previous);
    toast.error("Não foi possível mudar a presença");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger ref={trigger} className="relative rounded-item" title={person.name}>
        <Avatar initials={person.initials} seed={person.id} />
        <PresenceDot
          presence={presence}
          backdrop="chrome"
          decorative
          className="absolute -right-0.5 -bottom-0.5"
        />
        <span className="sr-only">Menu de {person.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        className="w-72"
        onCloseAutoFocus={(event) => {
          profile.onCloseAutoFocus(event);
          if (!editingProfile.current) return;
          editingProfile.current = false;
          event.preventDefault();
          openEditProfile(trigger.current);
        }}
      >
        <div className="flex items-center gap-3 px-4 pt-1 pb-2">
          <span className="relative inline-flex shrink-0">
            <Avatar initials={person.initials} seed={person.id} />
            <PresenceDot
              presence={presence}
              backdrop="raised"
              decorative
              className="absolute -right-0.5 -bottom-0.5"
            />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="flex min-w-0 items-center gap-1 text-body font-black text-fg">
              <span className="truncate">{person.name}</span>
              <UserStatus personId={person.id} status={sessionPerson.status} />
            </p>
            <p className="flex items-center gap-1 text-small text-fg-muted">
              <PresenceDot presence={presence} decorative />
              {presenceLabel(presence)}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void choosePresence(presence === "available" ? "away" : "available")}
        >
          {presence === "available" ? (
            <>
              Definir como <span className="font-bold">ausente</span>
            </>
          ) : (
            <>
              Definir como <span className="font-bold">disponível</span>
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => profile.open(person.id, trigger.current)}
        >
          <CircleUser size={16} aria-hidden />
          Perfil
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            editingProfile.current = true;
          }}
        >
          <Pencil size={16} aria-hidden />
          Editar perfil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <BrowserNotificationsItem {...browserNotifications} />
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

// A opção da notificação do navegador, como os frames "Casca / Menu do usuário" (spec da F08, "Opção
// do navegador"): ativar, desativar ou bloqueada; sem a API de notificação, o item não aparece.
function BrowserNotificationsItem({
  state,
  enable,
  disable,
}: ReturnType<typeof useBrowserNotifications>) {
  if (state === "unsupported") return null;
  return (
    <>
      {state === "on" ? (
        <DropdownMenuItem onSelect={disable}>
          <BellOff size={16} aria-hidden />
          Desativar notificações do navegador
        </DropdownMenuItem>
      ) : (
        <DropdownMenuItem
          disabled={state === "blocked"}
          onSelect={() => void enable()}
          className={state === "blocked" ? "h-auto items-start py-2" : undefined}
        >
          <Bell size={16} aria-hidden className={state === "blocked" ? "mt-0.5" : undefined} />
          <span className="flex flex-col">
            Ativar notificações do navegador
            {state === "blocked" && (
              <span className="text-caption text-fg-muted">Bloqueadas neste navegador</span>
            )}
          </span>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
    </>
  );
}
