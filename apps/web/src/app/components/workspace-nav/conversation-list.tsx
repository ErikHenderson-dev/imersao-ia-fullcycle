"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import type { Conversation } from "@/app/services/chat-api";
import { applyMemberAdded } from "@/app/utils/conversation-list";
import { AddChannelAction } from "./add-channel-action";
import { NewConversationAction } from "./new-conversation-action";
import { SidebarRow } from "./sidebar-row";
import { SidebarSection } from "./sidebar-section";

// A rota do BFF que lê a lista de novo.
const CONVERSATIONS_URL = "/api/conversations";

// A chave do cache da lista de Conversas, por Pessoa: quem entra depois de outra na mesma aba, sem
// recarregar a página, não herda a lista dela. O cabeçalho da Conversa lê o mesmo cache.
export function conversationsKey(personId: string): [string, string] {
  return [CONVERSATIONS_URL, personId];
}

// Um 401 aqui é só uma falha: a lista que está na tela fica, e quem leva a "Entrar" é o fim da
// Sessão no tempo real (session.ended) ou a próxima ação da Pessoa. Sem isso, a busca do reset da
// primeira conexão disputaria a navegação com quem acabou de sair.
async function fetchConversations(): Promise<readonly Conversation[]> {
  const response = await fetch(CONVERSATIONS_URL);
  if (!response.ok) throw new Error("Não foi possível carregar as conversas.");
  return (await response.json()) as Conversation[];
}

type ConversationListProps = {
  // A lista lida pelo Server Component, ponto de partida do cache.
  initialConversations: readonly Conversation[];
  // A Pessoa da Sessão: o evento põe a Conversa na lista só de quem acabou de entrar nela.
  personId: string;
};

// As seções "Canais" e "Mensagens diretas" no cliente (spec da F04, "Lista de Conversas no
// cliente"; spec da F05): o conversation.member_added muda o cache sem nova requisição, e o reset
// do tempo real busca a lista de novo. Uma falha nessa busca mantém a lista que já está na tela.
export function ConversationList({ initialConversations, personId }: ConversationListProps) {
  const { data: conversations, mutate } = useSWR(conversationsKey(personId), fetchConversations, {
    fallbackData: initialConversations,
    revalidateOnMount: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const { subscribe } = useRealtime();

  // Uma lista nova do servidor (a revalidação do layout depois de criar um Canal) vale mais que a
  // do cache, que o fallbackData não substitui depois do primeiro mutate.
  useEffect(() => {
    void mutate(initialConversations, { revalidate: false });
  }, [initialConversations, mutate]);

  useEffect(
    () =>
      subscribe({
        onMemberAdded: ({ conversation, personIds }) => {
          void mutate(
            (current) =>
              applyMemberAdded(current ?? initialConversations, conversation, personIds, personId),
            { revalidate: false },
          );
        },
        onSync: (event) => {
          if (event.reset) void mutate();
        },
        replayLastReset: true,
      }),
    [subscribe, mutate, initialConversations, personId],
  );

  const channels = conversations.filter((conversation) => conversation.kind !== "direct");
  const directs = conversations.filter((conversation) => conversation.kind === "direct");
  const row = (conversation: Conversation) => (
    <SidebarRow
      key={conversation.id}
      href={`/conversas/${conversation.id}`}
      conversation={conversation}
      selfId={personId}
    />
  );
  return (
    <>
      <SidebarSection title="Canais">
        {channels.map(row)}
        <AddChannelAction />
      </SidebarSection>
      <SidebarSection title="Mensagens diretas">
        {directs.map(row)}
        <NewConversationAction personId={personId} />
      </SidebarSection>
    </>
  );
}
