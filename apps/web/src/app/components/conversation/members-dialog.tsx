"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useRealtime } from "@/app/components/realtime/realtime-provider";
import { Button } from "@/app/components/ui/button";
import { DialogBody, DialogContent, DialogFooter } from "@/app/components/ui/dialog";
import { Spinner } from "@/app/components/ui/spinner";
import { PersonRow } from "@/app/components/user/person-row";
import type { ConversationKind, PersonEntry } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";
import { AddPeopleStep } from "./add-people-step";

async function fetchMembers(url: string): Promise<PersonEntry[]> {
  const response = await fetch(url);
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Não foi possível carregar os Membros.");
  return (await response.json()) as PersonEntry[];
}

type MembersDialogProps = {
  conversation: { id: string; name: string; kind: ConversationKind };
  personId: string;
  // Escolher uma Pessoa da lista abre o Perfil dela.
  onPersonSelect: (personId: string) => void;
  onCloseAutoFocus: (event: Event) => void;
};

// "Membros de #nome" ("Conversa / Sobreposições / Membros do canal"): lida ao abrir e de novo a
// cada conversation.member_added da Conversa enquanto está aberta. No Canal privado, "Adicionar
// pessoas" troca o conteúdo pelo passo da criação, e adicionar ou voltar mostra a lista de novo
// (spec da F04, "Lista de Membros").
export function MembersDialog({
  conversation,
  personId,
  onPersonSelect,
  onCloseAutoFocus,
}: MembersDialogProps) {
  const [view, setView] = useState<"list" | "add">("list");
  const membersKey = `/api/conversations/${encodeURIComponent(conversation.id)}/members`;
  const { data: members, error, mutate } = useSWR(membersKey, fetchMembers, {
    revalidateOnFocus: false,
  });
  const { subscribe } = useRealtime();

  useEffect(
    () =>
      subscribe({
        onMemberAdded: (event) => {
          if (event.conversation.id === conversation.id) void mutate();
        },
        // Uma queda pode ter perdido Pessoas adicionadas: o reset busca a lista de novo.
        onSync: (event) => {
          if (event.reset) void mutate();
        },
      }),
    [subscribe, mutate, conversation.id],
  );

  if (view === "add") {
    return (
      <AddPeopleStep
        conversation={conversation}
        onDone={() => {
          void mutate();
          setView("list");
        }}
        secondary={{ label: "Voltar", onClick: () => setView("list") }}
      />
    );
  }

  return (
    <DialogContent title={`Membros de #${conversation.name}`} onCloseAutoFocus={onCloseAutoFocus}>
      <DialogBody>
        {!members && !error && (
          <p role="status" className="flex items-center gap-2 p-2 text-body text-fg-muted">
            <Spinner />
            Carregando os membros…
          </p>
        )}
        {error && !members && (
          <div className="flex flex-col items-start gap-2 p-2">
            <p role="alert" className="text-small text-danger-fg">
              Não foi possível carregar os membros.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void mutate()}>
              Tentar de novo
            </Button>
          </div>
        )}
        {members && (
          <ul aria-label="Membros" className="flex max-h-96 flex-col overflow-y-auto">
            {members.map((member) => (
              <li key={member.id} className="flex">
                <button
                  type="button"
                  onClick={() => onPersonSelect(member.id)}
                  className="flex flex-1 items-center rounded-item p-2 text-left hover:bg-surface-subtle"
                >
                  <PersonRow person={member} isSelf={member.id === personId} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogBody>
      {conversation.kind === "private_channel" && (
        <DialogFooter>
          <Button type="button" onClick={() => setView("add")}>
            Adicionar pessoas
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}
