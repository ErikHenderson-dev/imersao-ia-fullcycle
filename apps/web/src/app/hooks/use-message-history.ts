"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import useSWRInfinite from "swr/infinite";
import type { Message, MessagePage } from "@/app/services/chat-api";
import {
  appendToLatestPage,
  flattenPages,
  patchQuotes,
  recordEdit,
  removeDeleted,
  replaceEdited,
} from "@/app/utils/message-pages";
import { forgetMessage, rememberEdit, rememberMessage } from "@/app/utils/recent-messages";

// Quantas Mensagens gravadas nesta abertura o histórico guarda para devolver ao cache.
const SAVED_LIMIT = 100;
import { redirectToExpiredSession } from "@/app/utils/return-path";

type PageKey = readonly ["messages", string, string | null];

// Uma página do histórico pela rota do BFF: a mais recente sem `before`, ou a anterior a ele. A
// Sessão recusada leva a "Entrar"; numa página anterior, a Conversa que deixou de existir para a
// Pessoa recarrega a página, que mostra "Conversa não encontrada"; outra falha vira erro (do SWR,
// e o link "Carregar mensagens anteriores" tenta de novo).
async function fetchPage(
  conversationId: string,
  before?: string,
  limit?: number,
): Promise<MessagePage> {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  if (limit !== undefined) params.set("limit", String(limit));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages${query}`,
  );
  if (response.status === 401) return redirectToExpiredSession();
  if (response.status === 404 && before) {
    window.location.reload();
    return new Promise<never>(() => {});
  }
  if (!response.ok) throw new Error("Não foi possível carregar as mensagens.");
  return (await response.json()) as MessagePage;
}

// Histórico de uma Conversa no cache do SWR (spec da F02, "Leituras"). pages[0] é a página mais
// recente, que vem do Server Component como fallbackData e nunca é buscada na API; a página
// n tem a chave da Mensagem mais antiga da página n-1 e só existe enquanto ela tem `hasMore`. Os
// eventos do tempo real (F03) entram neste mesmo cache.
export function useMessageHistory(conversationId: string, initialPage: MessagePage) {
  // A página mais recente como está agora no cache. Ao carregar uma anterior, o SWR pode pedir a
  // página 0 de novo; ela volta como está, com as Mensagens enviadas nesta abertura, e não como a
  // página inicial do servidor.
  const latestPage = useRef(initialPage);
  // O tamanho da próxima página anterior: o padrão, ou o maior da ida até a Mensagem citada.
  const olderPageSize = useRef<number | undefined>(undefined);
  const { data, mutate, size, setSize, error, isValidating } = useSWRInfinite<
    MessagePage,
    Error,
    (index: number, previous: MessagePage | null) => PageKey | null
  >(
    (index, previous) => {
      if (index === 0) return ["messages", conversationId, null];
      const oldest = previous?.messages[0];
      return previous?.hasMore && oldest ? ["messages", conversationId, oldest.id] : null;
    },
    (key) => {
      if (key[2] === null) return Promise.resolve(latestPage.current);
      // O tamanho maior vale só para a carga que o pediu, e não para uma releitura depois.
      const limit = olderPageSize.current;
      olderPageSize.current = undefined;
      return fetchPage(key[1], key[2], limit);
    },
    {
      fallbackData: [initialPage],
      revalidateOnMount: false,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    },
  );
  const pages = useMemo(() => data ?? [initialPage], [data, initialPage]);
  useLayoutEffect(() => {
    latestPage.current = pages[0] ?? initialPage;
  }, [pages, initialPage]);
  const messages = useMemo(() => flattenPages(pages), [pages]);
  const hasOlder = pages.at(-1)?.hasMore ?? false;
  const isLoadingOlder = isValidating && size > pages.length;

  // `pageSize`, só na ida até a Mensagem citada, pede uma página maior.
  const loadOlder = useCallback(
    (pageSize?: number) => {
      if (!hasOlder || isLoadingOlder) return;
      olderPageSize.current = pageSize;
      void setSize(pages.length + 1);
    },
    [hasOlder, isLoadingOlder, pages.length, setSize],
  );

  // As últimas Mensagens gravadas nesta abertura, pelo envio ou pelo tempo real. Uma carga de
  // anteriores que começou antes de uma delas entrar no cache pode terminar depois e gravar as
  // páginas sem ela; aqui ela volta.
  const saved = useRef<readonly Message[]>([]);

  const appendSaved = useCallback(
    (message: Message) => {
      saved.current = rememberMessage(saved.current, message, SAVED_LIMIT);
      void mutate((current) => appendToLatestPage(current ?? [initialPage], message), {
        revalidate: false,
      });
    },
    [mutate, initialPage],
  );

  // Uma Mensagem editada, pela própria edição ou pelo tempo real: troca no cache só se for mais nova
  // (spec da F06, "Eventos no cliente").
  // A última edição vista de cada Mensagem: uma edição atrasada não volta o texto das Citações.
  const editVersions = useRef(new Map<string, string>());
  const applyEdited = useCallback(
    (message: Message) => {
      if (!recordEdit(editVersions.current, message)) return;
      saved.current = rememberEdit(saved.current, message);
      void mutate(
        (current) =>
          patchQuotes(replaceEdited(current ?? [initialPage], message), {
            id: message.id,
            edited: message,
          }),
        { revalidate: false },
      );
    },
    [mutate, initialPage],
  );

  // Uma Mensagem apagada, pela própria exclusão ou pelo tempo real, sai do cache e das gravadas nesta
  // abertura, e fica no conjunto das apagadas, que a recarga do reset não traz de volta (spec da F06,
  // "Eventos no cliente").
  const deleted = useRef(new Set<string>());
  const applyDeleted = useCallback(
    (messageId: string) => {
      deleted.current.add(messageId);
      saved.current = forgetMessage(saved.current, messageId);
      void mutate(
        (current) =>
          patchQuotes(removeDeleted(current ?? [initialPage], messageId), {
            id: messageId,
            deleted: true,
          }),
        { revalidate: false },
      );
    },
    [mutate, initialPage],
  );

  useEffect(() => {
    const present = new Set(messages.map((message) => message.id));
    const missing = saved.current.filter((message) => !present.has(message.id));
    if (missing.length === 0) return;
    void mutate(
      (current) => missing.reduce(appendToLatestPage, current ?? [initialPage]),
      { revalidate: false },
    );
  }, [messages, mutate, initialPage]);

  // Com o reset do tempo real, o cache vira só a página mais recente, lida de novo pela rota do BFF,
  // como ao abrir a Conversa (spec da F03, "Mensagens no histórico"). Uma falha deixa o cache como
  // está. As gravadas nesta abertura ficam guardadas: uma que chegou durante a leitura volta ao
  // cache pelo efeito que confere as que faltam.
  const reloadRequest = useRef(0);
  const reloadLatest = useCallback(async () => {
    // Dois resets seguidos: só a resposta do último vale.
    const request = ++reloadRequest.current;
    let page: MessagePage;
    try {
      page = await fetchPage(conversationId);
    } catch {
      return;
    }
    if (request !== reloadRequest.current) return;
    // Uma edição que chegou durante a leitura é mais nova que a página lida: volta por cima dela.
    // Uma exclusão que chegou durante a leitura também vale.
    // As Citações também: a edição e a exclusão vistas valem para as respostas da página lida.
    const edited = saved.current.reduce<MessagePage[]>(
      (pages, message) =>
        message.editedAt
          ? patchQuotes(replaceEdited(pages, message), { id: message.id, edited: message })
          : pages,
      [page],
    );
    const merged = [...deleted.current].reduce(
      (pages, messageId) => patchQuotes(removeDeleted(pages, messageId), { id: messageId, deleted: true }),
      edited,
    )[0];
    latestPage.current = merged;
    await setSize(1);
    await mutate([merged], { revalidate: false });
  }, [conversationId, mutate, setSize]);

  return {
    messages,
    hasOlder,
    isLoadingOlder,
    olderFailed: Boolean(error),
    loadOlder,
    appendSaved,
    applyEdited,
    applyDeleted,
    reloadLatest,
  };
}
