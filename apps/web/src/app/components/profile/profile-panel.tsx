"use client";

import { Mail, MessageSquare, Phone, X } from "lucide-react";
import { useEffect } from "react";
import useSWR from "swr";
import { Avatar } from "@/app/components/ui/avatar";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { IconButton } from "@/app/components/ui/icon-button";
import type { Profile } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { useProfilePanelActions, useProfilePanelPerson } from "./profile-panel-provider";

class ProfileNotFoundError extends Error {}


async function fetchProfile(url: string): Promise<Profile> {
  const response = await fetch(url);
  if (response.status === 401) return redirectToExpiredSession();
  if (response.status === 404) throw new ProfileNotFoundError();
  if (!response.ok) throw new Error("Não foi possível carregar o perfil.");
  return (await response.json()) as Profile;
}

// O painel de perfil ("Painel de perfil", Figma): ao lado da Conversa a partir de 1280 px, sobre ela
// abaixo disso, e na largura toda abaixo de 640 px (design system, "Layout e responsividade").
// O próprio Perfil é igual ao dos outros: "Editar perfil" só entra com a F09.
export function ProfilePanel() {
  const personId = useProfilePanelPerson();
  const { closeProfile, focusPanel, panelFocusTarget } = useProfilePanelActions();

  // O foco entra no painel a cada abertura, e não a cada troca de Perfil.
  const isOpen = personId !== null;
  useEffect(() => {
    if (isOpen) focusPanel();
  }, [isOpen, focusPanel]);

  if (!personId) return null;
  return (
    <aside
      aria-labelledby="profile-panel-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          closeProfile();
        }
      }}
      className="absolute inset-y-0 right-0 z-20 flex w-full animate-slide-in flex-col border-l border-border bg-surface shadow-3 sm:w-panel xl:static xl:shadow-none"
    >
      <header className="flex h-header shrink-0 items-center justify-between border-b border-border pr-2 pl-5">
        <h2 id="profile-panel-title" className="text-title font-black text-fg">
          Perfil
        </h2>
        <IconButton
          ref={panelFocusTarget}
          icon={X}
          label="Fechar perfil"
          onClick={closeProfile}
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <ProfileContent personId={personId} />
      </div>
    </aside>
  );
}

function ProfileContent({ personId }: { personId: string }) {
  const { data: profile, error, isLoading, mutate } = useSWR(
    `/api/people/${encodeURIComponent(personId)}`,
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
      <div className="flex flex-wrap gap-2">
        {/* A Conversa direta só existe a partir da F05-T04. */}
        <Button type="button" variant="secondary" icon={MessageSquare} disabled>
          Mensagem
        </Button>
      </div>
      <section
        aria-labelledby="profile-contact-title"
        className="flex flex-col gap-3 border-t border-border-subtle pt-5"
      >
        <h3 id="profile-contact-title" className="text-body font-black text-fg">
          Informações de contato
        </h3>
        <ContactRow icon={Mail} label="E-mail">
          <a href={`mailto:${profile.email}`} className="break-all text-link hover:text-link-hover hover:underline">
            {profile.email}
          </a>
        </ContactRow>
        {profile.phone && (
          <ContactRow icon={Phone} label="Telefone">
            <a href={`tel:${profile.phone.replace(/[^0-9+]/g, "")}`} className="text-link hover:text-link-hover hover:underline">
              {profile.phone}
            </a>
          </ContactRow>
        )}
      </section>
    </div>
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
