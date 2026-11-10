"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { addMembers } from "@/app/actions/add-members";
import { Button } from "@/app/components/ui/button";
import { DialogBody, DialogContent, DialogFooter } from "@/app/components/ui/dialog";
import { IconButton } from "@/app/components/ui/icon-button";
import { PeoplePicker } from "@/app/components/user/people-picker";
import { usePeopleSearch } from "@/app/hooks/use-people-search";
import type { PersonEntry } from "@/app/services/chat-api";
import { redirectToExpiredSession } from "@/app/utils/return-path";

type AddPeopleStepProps = {
  conversation: { id: string; name: string };
  // Depois de adicionar: quem abriu o passo decide o que vem (abrir o Canal, voltar à lista).
  onDone: () => void;
  // O botão secundário: "Pular", que fecha o diálogo, na criação; "Voltar", na lista de Membros.
  secondary: { label: string; onClick: () => void };
  onCloseAutoFocus?: (event: Event) => void;
};

// Passo "Adicionar pessoas" ("Diálogos / Adicionar pessoas"): busca as Pessoas do workspace pelo
// nome ou @usuário (F05), sem os Membros, e adiciona as escolhidas ao Canal privado (spec da F04, "Passo 'Adicionar
// pessoas'"). Usado depois de criar o Canal e pela lista de Membros. Fechar o diálogo, pelo X, pelo
// Esc ou por "Pular", fica com quem o abriu.
export function AddPeopleStep({
  conversation,
  onDone,
  secondary,
  onCloseAutoFocus,
}: AddPeopleStepProps) {
  const [query, setQuery] = useState("");
  const search = usePeopleSearch(query, conversation.id);
  const [chosen, setChosen] = useState<PersonEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "failure">("idle");

  const chosenIds = new Set(chosen.map((person) => person.id));
  // As escolhidas continuam nos resultados, marcadas: a busca devolve no máximo 20, e tirá-las da
  // lista a esvaziaria.
  const results = search.kind === "ok" ? search.people : [];
  const isSending = status === "sending";
  const canAdd = chosen.length > 0 && !isSending;

  // Mudar as escolhidas tira a falha anterior.
  function updateChosen(next: (current: PersonEntry[]) => PersonEntry[]) {
    setChosen(next);
    if (status === "failure") setStatus("idle");
  }

  async function confirm() {
    if (!canAdd) return;
    setStatus("sending");
    const result = await addMembers(
      conversation.id,
      chosen.map((person) => person.id),
    ).catch(() => ({ kind: "failure" }) as const);
    if (result.kind === "ok") return onDone();
    if (result.kind === "unauthenticated") return redirectToExpiredSession();
    setStatus("failure");
  }

  return (
    <DialogContent
      title={`Adicionar pessoas ao #${conversation.name}`}
      description="Só quem está no canal vê as mensagens dele."
      dismissible={!isSending}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <DialogBody>
        <PeoplePicker
          query={query}
          onQueryChange={setQuery}
          people={search.kind === "ok" ? results : null}
          selectedIds={chosenIds}
          disabled={isSending}
          onPick={(person) =>
            updateChosen((current) =>
              chosenIds.has(person.id)
                ? current.filter((item) => item.id !== person.id)
                : [...current, person],
            )
          }
          emptyState={
            search.kind === "failure" ? (
              <p className="px-2 py-3 text-small text-danger-fg">
                Não foi possível buscar as pessoas.
              </p>
            ) : search.kind === "ok" ? (
              <p className="px-2 py-3 text-body text-fg-muted">Ninguém encontrado.</p>
            ) : null
          }
        />
        {chosen.length > 0 && (
          <ul aria-label="Escolhidas" className="flex flex-wrap gap-2">
            {chosen.map((person) => (
              <li
                key={person.id}
                className="flex items-center gap-1 rounded-pill bg-surface-subtle py-0.5 pl-3 pr-1 text-small font-bold text-fg"
              >
                {person.name}
                <IconButton
                  icon={X}
                  label={`Tirar ${person.name}`}
                  size="sm"
                  disabled={isSending}
                  onClick={() =>
                    updateChosen((current) => current.filter((item) => item.id !== person.id))
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {status === "failure" && (
          <p role="alert" className="text-small text-danger-fg">
            Não foi possível adicionar as pessoas. Tente de novo.
          </p>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" disabled={isSending} onClick={secondary.onClick}>
          {secondary.label}
        </Button>
        <Button
          type="button"
          loading={isSending}
          disabled={!canAdd}
          onClick={() => void confirm()}
        >
          Adicionar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
