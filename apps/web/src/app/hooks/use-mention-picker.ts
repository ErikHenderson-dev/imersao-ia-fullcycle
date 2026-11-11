"use client";

import { useContext, useId, useState } from "react";
import { AgentsContextForPicker } from "@/app/components/agent/agents-provider";
import { usePeopleSearch } from "@/app/hooks/use-people-search";
import type { Agent } from "@/app/services/agents-service";
import type { PersonEntry } from "@/app/services/chat-api";
import { agentMentionOptions } from "@/app/utils/agent-mentions";
import { applyMention, findMentionQuery } from "@/app/utils/mention-query";

// Uma opção da lista de menções: uma Pessoa, Membro da Conversa, ou um Agente conectado (F10).
export type MentionOption = { kind: "person"; person: PersonEntry } | { kind: "agent"; agent: Agent };

type MentionPickerOptions = {
  // A Conversa cujos Membros a lista mostra; sem ela, a lista não existe.
  conversationId: string | undefined;
  text: string;
  setText: (text: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

// A lista de menções de uma caixa de texto (spec da F06, "Lista de menções"): abre com o `@` logo
// antes do cursor, busca os Membros da Conversa pelo que vem depois e segue o padrão combobox, com o
// foco na caixa. Quem usa espalha `textareaProps` na caixa (antes dos próprios `onChange` e
// `onKeyDown`, que chama por `handleChange` e `handleKeyDown`).
export function useMentionPicker({
  conversationId,
  text,
  setText,
  textareaRef,
}: MentionPickerOptions) {
  const listId = useId();
  const [caret, setCaret] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  // O `@` cuja lista foi fechada pelo Esc: ela só volta com outro `@`.
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const query = conversationId && caret !== null ? findMentionQuery(text, caret) : null;
  // A marca do Esc vale só enquanto aquele `@` existe: apagado e digitado de novo, a lista volta.
  if (dismissedAt !== null && query?.start !== dismissedAt) setDismissedAt(null);
  const isWanted = query !== null && query.start !== dismissedAt;
  const search = usePeopleSearch(query?.query ?? "", { memberOf: conversationId }, isWanted);
  const agents = useContext(AgentsContextForPicker)?.agents ?? null;
  // Só o resultado da busca do texto atual: enquanto ela não responde, a lista some, para Enter não
  // escolher uma Pessoa que não corresponde ao que foi digitado. Os Agentes conectados vêm depois
  // dos Membros (spec da F10, "Menção a um Agente").
  const isSettled = isWanted && search.kind === "ok" && search.query === query.query;
  const options: MentionOption[] = isSettled
    ? [
        ...search.people.map((person) => ({ kind: "person" as const, person })),
        ...agentMentionOptions(agents, query.query).map((agent) => ({ kind: "agent" as const, agent })),
      ]
    : [];
  const isOpen = options.length > 0;
  const activeIndex = Math.min(active, Math.max(options.length - 1, 0));
  const optionId = (index: number) => `${listId}-${index}`;

  function moveCaret(position: number) {
    setCaret(position);
    setActive(0);
  }

  // Troca o texto (escolha na lista, botão @) e põe o foco e o cursor na posição, depois de renderizar.
  function replaceText(value: string, position: number) {
    setText(value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(position, position);
      moveCaret(position);
    });
  }

  function pick(option: MentionOption) {
    if (!query || caret === null) return;
    const username = option.kind === "person" ? option.person.username : option.agent.username;
    const next = applyMention(text, query, caret, username);
    replaceText(next.text, next.caret);
  }

  // Verdadeiro quando a tecla era da lista: Enter e Tab escolhem sem enviar nem salvar, e Esc fecha
  // sem cancelar a edição nem fechar outra camada.
  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
    if (!isOpen || !query) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + options.length) % options.length);
      return true;
    }
    if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
      event.preventDefault();
      pick(options[activeIndex]);
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
    replaceText,
    handleKeyDown,
    handleChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
      moveCaret(event.target.selectionStart),
    // Os atributos da caixa de texto, que continua no papel dela (textbox, que aceita a lista
    // ligada e a opção ativa).
    textareaProps: conversationId
      ? {
          "aria-autocomplete": "list" as const,
          "aria-controls": isOpen ? listId : undefined,
          "aria-activedescendant": isOpen ? optionId(activeIndex) : undefined,
          onSelect: (event: React.SyntheticEvent<HTMLTextAreaElement>) =>
            moveCaret(event.currentTarget.selectionStart),
        }
      : {},
    list: isOpen ? { id: listId, options, activeIndex, optionId, pick } : null,
  };
}
