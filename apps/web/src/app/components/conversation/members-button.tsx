"use client";

import { Users } from "lucide-react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { useOpenProfileFromOverlay } from "@/app/components/profile/profile-panel-provider";
import { Dialog, DialogTrigger } from "@/app/components/ui/dialog";
import { conversationsKey } from "@/app/components/workspace-nav/conversation-list";
import type { Conversation } from "@/app/services/chat-api";
import { fetchConversationList } from "@/app/services/conversation-list";
import { MembersDialog } from "./members-dialog";

type MembersButtonProps = {
  conversation: Pick<Conversation, "id" | "name" | "kind" | "memberCount">;
  personId: string;
};

// O botão de Membros do ConversationHeader: a quantidade vem da lista de Conversas no cliente, que o
// tempo real atualiza, com a Conversa do servidor como ponto de partida (spec da F04, "Cabeçalho do
// Canal"). Abre "Membros de #nome".
export function MembersButton({ conversation, personId }: MembersButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Escolher uma Pessoa fecha o diálogo e abre o Perfil dela, com o foco no painel; ao fechar o
  // painel, ele volta a este botão (spec da F05, "Onde o Perfil abre").
  const profile = useOpenProfileFromOverlay();
  const trigger = useRef<HTMLButtonElement>(null);
  // Só lê o cache que a barra lateral mantém, sem buscar sozinho; com a mesma busca dela, porque o
  // reset do tempo real revalida a chave pela busca do primeiro hook registrado nela.
  const { data: conversations } = useSWR(conversationsKey(personId), fetchConversationList, {
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const memberCount =
    conversations?.find((item) => item.id === conversation.id)?.memberCount ??
    conversation.memberCount;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          ref={trigger}
          type="button"
          aria-label={`Membros: ${memberCount}`}
          className="flex h-7 shrink-0 items-center gap-1 rounded-control border border-border px-2 text-small font-bold text-fg-muted hover:bg-surface-subtle"
        >
          <Users size={16} aria-hidden />
          <span aria-hidden>{memberCount}</span>
        </button>
      </DialogTrigger>
      {isOpen && (
        <MembersDialog
          conversation={conversation}
          personId={personId}
          onCloseAutoFocus={profile.onCloseAutoFocus}
          onPersonSelect={(selectedId) => {
            setIsOpen(false);
            profile.open(selectedId, trigger.current);
          }}
        />
      )}
    </Dialog>
  );
}
