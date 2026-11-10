"use client";

import { useId, useState } from "react";
import { usePeopleSearch } from "@/app/hooks/use-people-search";
import type { PersonEntry } from "@/app/services/chat-api";
import { applyMention, findMentionQuery } from "@/app/utils/mention-query";

type MentionPickerOptions = {
  conversationId: string;
  text: string;
  // Troca o texto e põe o cursor na posição dada.
  replaceText: (text: string, caret: number) => void;
};

// A lista de menções de uma caixa de texto (spec da F06, "Lista de menções"): abre com o `@` logo
// antes do cursor, busca os Membros da Conversa pelo que vem depois e segue o padrão combobox, com o
// foco na caixa. Quem usa chama `onKeyDown` antes do próprio tratamento das teclas e `onCaret` a cada
// mudança do texto ou do cursor.
export function useMentionPicker({ conversationId, text, replaceText }: MentionPickerOptions) {
  const listId = useId();
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  // O `@` cuja lista foi fechada pelo Esc: ela só volta com outro `@`.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const query = caret === null ? null : findMentionQuery(text, caret);
  // A marca do Esc vale só enquanto aquele `@` existe: apagado e digitado de novo, a lista volta.
  if (dismissedAt !== null && query?.start !== dismissedAt) setDismissedAt(null);
  const isWanted = query !== null && query.start !== dismissedAt;
  const search = usePeopleSearch(query?.query ?? "", { memberOf: conversationId }, isWanted);
  // Enquanto a busca do texto atual não responde, a lista é a da anterior.
  const people: PersonEntry[] = isWanted && search.kind === "ok" ? search.people : [];
  const isOpen = people.length > 0;
  const activeIndex = Math.min(active, Math.max(people.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  function onCaret(position: number) {
    setCaret(position);
    setActive(0);
  }

  function pick(person: PersonEntry) {
    if (!query || caret === null) return;
    const next = applyMention(text, query, caret, person.username);
    replaceText(next.text, next.caret);
    setCaret(next.caret);
  }

  // Verdadeiro quando a tecla era da lista: Enter e Tab escolhem sem enviar nem salvar, e Esc fecha
  // sem cancelar a edição nem fechar outra camada.
  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!isOpen || !query) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + people.length) % people.length);
      return true;
    }
    if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      event.preventDefault();
      pick(people[activeIndex]);
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setDismissedAt(query.start);
      return true;
    }
    return false;
  }

  return {
    onCaret,
    onKeyDown,
    // Os atributos da caixa de texto, que continua no papel dela (textbox, que aceita a lista
    // ligada e a opção ativa).
    inputProps: {
      "aria-autocomplete": "list" as const,
      "aria-controls": isOpen ? listId : undefined,
      "aria-activedescendant": isOpen ? optionId(activeIndex) : undefined,
    },
    list: isOpen ? { id: listId, people, activeIndex, optionId, pick } : null,
  };
}
