"use client";

import { Clock, Mail, MessageSquare, Pencil, Phone, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useOpenDirectConversation } from "@/app/hooks/use-open-direct-conversation";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { IconButton } from "@/app/components/ui/icon-button";
import type { Profile } from "@/app/services/chat-api";
import { localTimeLabel, msUntilNextMinute } from "@/app/utils/local-time";
import { isValidTimeZone } from "@/app/utils/time-zone";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { useProfilePanelActions, useProfilePanelPerson } from "./profile-panel-provider";
import { isTooltipEscape } from "@/app/components/ui/tooltip";
import { useEditProfile } from "./edit-profile-dialog";
import { UserStatusLine } from "@/app/components/people/user-status";

class ProfileNotFoundError extends Error {}

// A chave do Perfil no SWR, também usada por quem muda o Perfil e precisa que ele seja lido de novo.
export function profileKey(personId: string): string {
  return `/api/people/${encodeURIComponent(personId)}`;
}

export async function fetchProfile(url: string): Promise<Profile> {
  const response = await fetch(url);
  if (response.status === 401) return redirectToExpiredSession();
  if (response.status === 404) throw new ProfileNotFoundError();
  if (!response.ok) throw new Error("Não foi possível carregar o perfil.");
  return (await response.json()) as Profile;
}

// O painel de perfil ("Painel de perfil", Figma): ao lado da Conversa a partir de 1280 px, sobre ela
// abaixo disso, e na largura toda abaixo de 640 px (design system, "Layout e responsividade").
// O próprio Perfil tem, ao lado de "Mensagem", o botão "Editar perfil" (spec da F09, "Editar perfil").
export function ProfilePanel({ sessionPersonId }: { sessionPersonId: string }) {
  const personId = useProfilePanelPerson();
  const { closeProfile, focusPanel, panelFocusTarget } = useProfilePanelActions();

  // O foco entra no painel a cada abertura, e não a cada troca de Perfil.
  const isOpen = personId !== null;
  useEffect(() => {
    if (isOpen) focusPanel();
  }, [isOpen, focusPanel]);

  // Abaixo de 1280 px o painel cobre a Conversa e o foco pode sair dele pelo Tab: o Esc fecha de
  // qualquer lugar, menos de dentro de um diálogo ou menu, que trata o próprio Esc.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.defaultPrevented && !isTooltipEscape(event)) return;
      if ((event.target as Element | null)?.closest?.("[role=dialog], [role=menu]")) return;
      closeProfile();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeProfile]);

  if (!personId) return null;
  return (
    <aside
      aria-labelledby="profile-panel-title"
      className="absolute inset-y-0 right-0 z-20 flex w-full animate-slide-in flex-col border-l border-border bg-surface shadow-3 sm:w-panel xl:static xl:shadow-none"
    >
      <header className="flex h-header shrink-0 items-center justify-between border-b border-border pr-2 pl-5">
        <h2 id="profile-panel-title" className="text-title font-black text-fg">
          Perfil
        </h2>
        <IconButton ref={panelFocusTarget} icon={X} label="Fechar perfil" onClick={closeProfile} />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <ProfileContent personId={personId} sessionPersonId={sessionPersonId} />
      </div>
    </aside>
  );
}

function ProfileContent({
  personId,
  sessionPersonId,
}: {
  personId: string;
  sessionPersonId: string;
}) {
  const { data: profile, error, isLoading, mutate } = useSWR(
    profileKey(personId),
    fetchProfile,
    // Lido de novo a cada abertura, e não ao voltar o foco para a janela.
    { revalidateOnFocus: false, dedupingInterval: 0 },
  );

  if (error instanceof ProfileNotFoundError) {
    return (
      <EmptyState
        title="Pessoa não encontrada"
        description="Este perfil não existe mais ou o link está incorreto."
      />
    );
  }
  if (error && !profile) {
    return (
      <EmptyState
        title="Não foi possível carregar o perfil"
        description="Verifique sua conexão e tente de novo."
        action={
          <Button type="button" onClick={() => void mutate()}>
            Tentar de novo
          </Button>
        }
      />
    );
  }
  if (!profile || isLoading) {
    return (
      <div role="status" aria-label="Carregando o perfil" className="flex flex-col gap-4">
        <span className="size-24 motion-safe:animate-pulse rounded-panel bg-surface-inset" />
        <span className="h-6 w-48 motion-safe:animate-pulse rounded-control bg-surface-inset" />
        <span className="h-4 w-32 motion-safe:animate-pulse rounded-control bg-surface-inset" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Avatar initials={profile.initials} seed={profile.id} size="xl" />
      <div className="flex flex-col gap-1">
        <p className="text-heading font-black break-words text-fg">{profile.name}</p>
        {profile.title && <p className="text-body break-words text-fg">{profile.title}</p>}
        <p className="text-small text-fg-muted">@{profile.username}</p>
      </div>
      <UserStatusLine personId={profile.id} status={profile.status} />
      {/* Um fuso que este navegador não formata some, em vez de quebrar o painel. */}
      {isValidTimeZone(profile.timeZone) && <LocalTime timeZone={profile.timeZone} />}
      <div className="flex flex-wrap items-start gap-2">
        <OpenDirectConversationButton personId={profile.id} sessionPersonId={sessionPersonId} />
        {profile.id === sessionPersonId && <EditProfileButton />}
      </div>
      <section
        aria-labelledby="profile-contact-title"
        className="flex flex-col gap-3 border-t border-border-subtle pt-5"
      >
        <h3 id="profile-contact-title" className="text-body font-black text-fg">
          Informações de contato
        </h3>
        <ContactRow icon={Mail} label="E-mail">
          <a
            href={`mailto:${profile.email}`}
            className="break-all text-link hover:text-link-hover hover:underline"
          >
            {profile.email}
          </a>
        </ContactRow>
        {profile.phone && (
          <ContactRow icon={Phone} label="Telefone">
            <a
              href={`tel:${profile.phone.replace(/[^0-9+]/g, "")}`}
              className="text-link hover:text-link-hover hover:underline"
            >
              {profile.phone}
            </a>
          </ContactRow>
        )}
      </section>
    </div>
  );
}

// A hora atual no fuso da Pessoa, que muda na virada de cada minuto (Figma, "Local time").
function LocalTime({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Pelo relógio de agora, e não pelo do último render: depois de a máquina dormir, a hora
    // acerta na primeira volta.
    const timer = setTimeout(() => setNow(new Date()), msUntilNextMinute(new Date()));
    return () => clearTimeout(timer);
  }, [now]);
  return (
    <p className="flex items-center gap-2 text-body text-fg">
      <Clock size={16} aria-hidden />
      {localTimeLabel(timeZone, now)}
    </p>
  );
}

// "Mensagem": abre a Conversa direta com a Pessoa do Perfil, inclusive a própria (spec da F05,
// "Painel de perfil"). A Conversa entra na barra lateral na hora, e o member_added que chega depois
// é ignorado pelo id repetido.
function OpenDirectConversationButton({
  personId,
  sessionPersonId,
}: {
  personId: string;
  sessionPersonId: string;
}) {
  const { state, open } = useOpenDirectConversation(sessionPersonId);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        icon={MessageSquare}
        loading={state === "opening"}
        onClick={() => void open(personId)}
      >
        {state === "opening" ? "Abrindo…" : "Mensagem"}
      </Button>
      {state === "failed" && (
        <p role="alert" className="text-small text-danger-fg">
          Não foi possível abrir a conversa. Tente de novo.
        </p>
      )}
    </div>
  );
}

// "Editar perfil", só no próprio Perfil; o foco volta a ele quando o diálogo fecha.
function EditProfileButton() {
  const { openEditProfile } = useEditProfile();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <Button
      ref={button}
      type="button"
      variant="secondary"
      icon={Pencil}
      onClick={() => openEditProfile(button.current)}
    >
      Editar perfil
    </Button>
  );
}

type ContactRowProps = {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
};

// ContactRow (Figma): o ícone num quadro de 36 e o rótulo sobre o valor.
function ContactRow({ icon: Icon, label, children }: ContactRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-item bg-surface-inset text-fg">
        <Icon size={16} aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-small text-fg-muted">{label}</span>
        <span className="text-body">{children}</span>
      </div>
    </div>
  );
}
