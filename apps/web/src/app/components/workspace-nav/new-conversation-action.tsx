"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { DialogBody, DialogContent, Dialog, DialogTrigger } from "@/app/components/ui/dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Spinner } from "@/app/components/ui/spinner";
import { PeoplePicker } from "@/app/components/user/people-picker";
import { usePeopleSearch } from "@/app/hooks/use-people-search";
import { useOpenDirectConversation } from "@/app/hooks/use-open-direct-conversation";

// SidebarAction "Nova conversa", no fim de "Mensagens diretas" (spec da F05, "Busca de Pessoas"):
// abre o diálogo, com a busca de todas as Pessoas, inclusive a própria. Escolher uma abre a Conversa
// direta com ela; na falha, o diálogo fica aberto com o erro.
export function NewConversationAction({ personId }: { personId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <li>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center gap-2 rounded-item px-2 text-body text-sidebar-fg hover:bg-sidebar-hover md:h-7"
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-control bg-sidebar-field">
              <Plus size={12} aria-hidden />
            </span>
            Nova conversa
          </button>
        </DialogTrigger>
        {isOpen && <NewConversationDialog personId={personId} onOpened={() => setIsOpen(false)} />}
      </Dialog>
    </li>
  );
}

function NewConversationDialog({ personId, onOpened }: { personId: string; onOpened: () => void }) {
  const [query, setQuery] = useState("");
  const search = usePeopleSearch(query);
  const { state, open } = useOpenDirectConversation(personId);
  const isOpening = state === "opening";

  return (
    <DialogContent
      title="Nova conversa"
      description="Escolha alguém para conversar em particular."
      dismissible={!isOpening}
    >
      <DialogBody>
        <PeoplePicker
          query={query}
          onQueryChange={setQuery}
          people={search.kind === "ok" ? search.people : null}
          selfId={personId}
          disabled={isOpening}
          onPick={async (person) => {
            if (await open(person.id)) onOpened();
          }}
          emptyState={
            search.kind === "loading" ? (
              <p role="status" className="flex items-center gap-2 px-2 py-3 text-body text-fg-muted">
                <Spinner />
                Carregando as pessoas…
              </p>
            ) : search.kind === "failure" ? (
              <p className="px-2 py-3 text-small text-danger-fg">Não foi possível buscar as pessoas.</p>
            ) : (
              <EmptyState
                icon={Search}
                title="Ninguém encontrado"
                description={`Nenhuma pessoa corresponde a "${query}". Confira a grafia ou busque pelo @usuário.`}
              />
            )
          }
        />
        {state === "failed" && (
          <p role="alert" className="text-small text-danger-fg">
            Não foi possível abrir a conversa. Tente de novo.
          </p>
        )}
      </DialogBody>
    </DialogContent>
  );
}
