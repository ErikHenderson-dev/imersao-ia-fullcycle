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
import { PersonAvatar } from "@/app/components/people/person-display";
import { PresenceLine, presenceLabel } from "@/app/components/ui/presence-dot";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { clearTheme } from "@/app/utils/theme";
import { UserStatus } from "@/app/components/people/user-status";
import { useOpenProfileFromOverlay } from "@/app/components/profile/profile-panel-provider";
import { useBrowserNotifications } from "@/app/hooks/use-browser-notifications";
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
  const presence = useKnownPresence(person.id, sessionPerson.presenceChoice)!;
  const nextPresence: Presence = presence === "available" ? "away" : "available";

  // Aplica a escolha na hora e volta à anterior se a gravação falhar, a não ser que um evento mais
  // novo já tenha mudado a Presença enquanto a gravação corria.
  async function choosePresence(next: Presence) {
    const previous = presence;
    people.applyPresence(person.id, next);
    const result = await savePresenceChoice(next).catch(() => ({ kind: "failure" }) as const);
    if (result.kind === "ok") return;
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    if (people.getPresence(person.id) === next) people.applyPresence(person.id, previous);
    toast.error("Não foi possível mudar a presença");
  }

  const avatarPerson = { ...person, presence };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger ref={trigger} className="rounded-item" title={person.name}>
        <PersonAvatar person={avatarPerson} presenceBackdrop="chrome" />
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
          <PersonAvatar person={avatarPerson} presenceBackdrop="raised" />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="flex min-w-0 items-center gap-1 text-body font-black text-fg">
              <span className="truncate">{person.name}</span>
              <UserStatus personId={person.id} status={sessionPerson.status} />
            </p>
            <PresenceLine presence={presence} className="gap-1 text-small text-fg-muted" />
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void choosePresence(nextPresence)}>
          Definir como{" "}
          <span className="font-bold">{presenceLabel(nextPresence).toLowerCase()}</span>
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
            // "Entrar" fica no claro já na primeira pintura: a navegação mantém o layout raiz.
            clearTheme();
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
