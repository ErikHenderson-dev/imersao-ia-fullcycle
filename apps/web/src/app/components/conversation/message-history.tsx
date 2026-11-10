"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { composerLabel, conversationTitle } from "@/app/utils/conversation-title";
import { toast } from "sonner";
import { SWRConfig } from "swr";
import { MessageItem } from "@/app/components/message/message-item";
import { buttonVariants } from "@/app/components/ui/button";
import { Spinner } from "@/app/components/ui/spinner";
import { useMessageHistory } from "@/app/hooks/use-message-history";
import { JUMP_PAGE_SIZE, jumpStep } from "@/app/utils/jump-to-message";
import { firstUnreadId, needsOlderForUnread } from "@/app/utils/unread-opening";
import { useTabFocus } from "@/app/hooks/use-tab-focus";
import { useRealtimeMessages } from "@/app/hooks/use-realtime-messages";
import { useReadReport } from "@/app/hooks/use-read-report";
import { useTypingAnnouncer } from "@/app/hooks/use-typing";
import {
  type PendingMessage,
  type PendingStatus,
  usePendingMessages,
} from "@/app/hooks/use-pending-messages";
import type {
  Conversation,
  Message,
  MessageAuthor,
  MessagePage,
} from "@/app/services/chat-api";
import { dayKey, labelForDay } from "@/app/utils/day-label";
import { isCompact } from "@/app/utils/message-grouping";
import { ConversationIntro } from "./conversation-intro";
import { MessageComposer } from "./message-composer";
import { NewMessagesPill } from "./new-messages-pill";
import { TypingIndicator } from "./typing-indicator";

type MessageHistoryProps = {
  conversation: Conversation;
  initialPage: MessagePage;
  // Fuso das horas e dos dias, e o instante da renderização no servidor, que é o "agora" de
  // "Hoje" e "Ontem" dos dois lados, para a hidratação não divergir.
  timeZone: string;
  renderedAt: string;
  // A Pessoa da Sessão, autora das Mensagens que ainda estão sendo enviadas.
  currentPerson: MessageAuthor;
};

// Distância do topo em que o sentinela pede a página anterior (spec da F02, "Lista de Mensagens").
const LOAD_OLDER_MARGIN_PX = 300;

// Distância do fim da lista até a qual a Pessoa está "no fim" (LLD, "Valores e configuração").
const END_OF_LIST_PX = 100;

// Lista de Mensagens e caixa de mensagem de uma Conversa. O cache do SWR é desta montagem: abrir
// a Conversa de novo começa da página que o servidor acabou de ler.
export function MessageHistory(props: MessageHistoryProps) {
  return (
    <SWRConfig value={{ provider: () => new Map() }}>
      <History {...props} />
    </SWRConfig>
  );
}

// Quanto tempo a Mensagem citada fica destacada ao chegar (spec da F06, "Ir até a Mensagem citada").
const HIGHLIGHT_MS = 2_000;

function History({
  conversation,
  initialPage,
  timeZone,
  renderedAt,
  currentPerson,
}: MessageHistoryProps) {
  const {
    messages: saved,
    hasOlder,
    isLoadingOlder,
    olderFailed,
    loadOlder,
    appendSaved,
    applyEdited,
    applyDeleted,
    reloadLatest,
  } = useMessageHistory(conversation.id, initialPage);
  // A Mensagem em edição, uma por vez na Conversa (spec da F06, "Edição").
  const [editingId, setEditingId] = useState<string | null>(null);
  const closeEdit = useCallback((messageId: string) => {
    setEditingId((current) => (current === messageId ? null : current));
  }, []);
  // A Mensagem que a próxima vai citar (spec da F06, "Citação"). O histórico monta de novo a cada
  // Conversa, então trocar de Conversa desiste dela.
  const [quoting, setQuoting] = useState<Message | null>(null);
  // Uma Mensagem que sai da Conversa (spec da F06, "Apagar"): a edição aberta dela fecha, e a Citação
  // dela sai da caixa, com aviso. O tempo real a chama por um useEffectEvent, que sempre vê o estado
  // atual.
  const removeMessage = (messageId: string) => {
    if (editingId === messageId) {
      setEditingId(null);
      toast.info("Essa mensagem foi apagada.");
    }
    if (quoting?.id === messageId) {
      setQuoting(null);
      toast.info("A mensagem que você estava respondendo foi apagada.");
    }
    applyDeleted(messageId);
  };
  const { pending, send, retry, discard, dropDelivered } = usePendingMessages(
    conversation.id,
    currentPerson,
    appendSaved,
  );
  const { isSynced } = useRealtimeMessages(conversation.id, initialPage, {
    currentPersonId: currentPerson.id,
    appendSaved,
    applyEdited,
    applyDeleted: removeMessage,
    dropDelivered,
    reloadLatest,
  });
  const typing = useTypingAnnouncer(conversation.id);
  const newestOfSaved = saved.at(-1);
  const knownLastRead = useReadReport({
    conversationId: conversation.id,
    personId: currentPerson.id,
    newestSaved: newestOfSaved && { id: newestOfSaved.id, authorId: newestOfSaved.author.id },
    initialLastReadId: conversation.lastReadMessageId,
    isReady: isSynced,
  });
  // As pendentes vêm sempre depois das gravadas, e passam pelo mesmo agrupamento.
  const messages = useMemo<(Message & { status?: PendingStatus })[]>(
    () => [...saved, ...pending],
    [saved, pending],
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  // Marca a lista hidratada (data-ready), como o formulário de "Entrar": antes disso, a rolagem e
  // o sentinela ainda não respondem.
  useEffect(() => {
    scrollRef.current?.setAttribute("data-ready", "");
  }, []);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Âncora da rolagem, guardada antes de a página anterior entrar no começo: a Mensagem que abria
  // a lista e a posição do fim dela na área visível. O fim, e não o topo, porque essa Mensagem
  // pode virar compacta e perder o divisor quando a anterior chega, e encolhe por cima.
  const anchor = useRef<{ id: string; bottom: number } | null>(null);
  // A forma e o divisor de cada Mensagem, com o dia de cada uma calculado uma vez por lista.
  const rows = useMemo(() => {
    const today = dayKey(renderedAt, timeZone);
    const withDays = messages.map((message) => ({
      ...message,
      day: dayKey(message.createdAt, timeZone),
    }));
    return withDays.map((message, index) => {
      const previous = withDays[index - 1];
      return {
        message,
        compact: isCompact(previous, message),
        dayLabel: previous?.day === message.day ? undefined : labelForDay(message.day, today),
      };
    });
  }, [messages, timeZone, renderedAt]);
  const firstId = messages[0]?.id;

  // Se a Pessoa está no fim da lista, medido a cada rolagem e a cada mudança de tamanho da lista,
  // sempre antes de uma Mensagem nova entrar (o ResizeObserver só avisa depois dos efeitos de
  // layout da renderização que a trouxe).
  const isAtEnd = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  // A ida até a Mensagem citada (spec da F06, "Ir até a Mensagem citada"): a original procurada,
  // enquanto as páginas anteriores carregam, e a que fica destacada por 2 s ao chegar.
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const isJumping = useRef(false);
  // Se a ida já pediu uma página: só a falha dessa carga encerra a ida, e não uma falha de antes.
  const jumpRequestedLoad = useRef(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // O divisor de novas Mensagens (spec da F07, "Abrir na primeira Não lida e o divisor"): a Última
  // leitura guardada ao abrir, só com Não lidas naquele momento, é a referência dele, e ele não se
  // move enquanto a Pessoa fica na Conversa. Quando o foco da aba volta e chegaram Mensagens sem
  // foco, a referência passa a ser a Última leitura que o aviso de leitura conhecia.
  const [dividerAfter, setDividerAfter] = useState<{ lastReadId: string | null } | null>(() =>
    conversation.unreadCount > 0 ? { lastReadId: conversation.lastReadMessageId } : null,
  );
  const firstUnread = dividerAfter
    ? firstUnreadId(saved, dividerAfter.lastReadId, currentPerson.id)
    : null;
  const isFocused = useTabFocus();
  const wasFocused = useRef(isFocused);
  const onFocusBack = useEffectEvent(() => {
    const known = knownLastRead();
    if (firstUnreadId(saved, known, currentPerson.id)) setDividerAfter({ lastReadId: known });
  });
  // Só a volta do foco muda a referência.
  useEffect(() => {
    const was = wasFocused.current;
    wasFocused.current = isFocused;
    if (!was && isFocused) onFocusBack();
  }, [isFocused]);
  // A primeira Não lida longe da página carregada: as anteriores carregam, como na ida até a
  // Mensagem citada, até a lista começar na Última leitura.
  const [isSeekingUnread, setSeekingUnread] = useState(
    () =>
      dividerAfter !== null &&
      needsOlderForUnread(initialPage.messages, dividerAfter.lastReadId, initialPage.hasMore),
  );
  const seekRequestedLoad = useRef(false);
  const listRef = useRef<HTMLOListElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Depois de apagar a própria Mensagem, o foco vai para a seguinte da lista, ou para a caixa de
  // mensagem quando ela era a última (spec da F06, "Apagar").
  const deleteAndMoveFocus = (messageId: string) => {
    const index = rows.findIndex((row) => row.message.id === messageId);
    const nextId = index >= 0 ? rows[index + 1]?.message.id : undefined;
    removeMessage(messageId);
    requestAnimationFrame(() => {
      const next = nextId
        ? listRef.current?.querySelector<HTMLElement>(
            `[data-message-id="${nextId}"] :is(button, a, textarea):not([tabindex="-1"])`,
          )
        : null;
      (next ?? composerRef.current)?.focus();
    });
  };

  const measureEnd = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    isAtEnd.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <= END_OF_LIST_PX;
    if (isAtEnd.current) setHasNewBelow(false);
  }, []);

  const scrollToEnd = useCallback(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
    anchor.current = null;
    isAtEnd.current = true;
    setHasNewBelow(false);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    const list = listRef.current;
    if (!element || !list) return;
    const observer = new ResizeObserver(measureEnd);
    observer.observe(element);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measureEnd]);

  // Os client_id enviados por esta aba: a Mensagem gravada que veio da própria caixa de mensagem já
  // rolou a lista quando foi enviada, e não rola de novo nem mostra a pílula.
  const sentHere = useRef(new Set<string>());
  const newestPending = pending.at(-1)?.clientId;
  useLayoutEffect(() => {
    if (!newestPending || sentHere.current.has(newestPending)) return;
    sentHere.current.add(newestPending);
    scrollToEnd();
  }, [newestPending, scrollToEnd]);

  // Ao abrir, a lista rola até a última Mensagem. Depois, uma Mensagem gravada nova no fim, de
  // outra Pessoa ou de outra aba, só rola a lista quando a Pessoa estava no fim; lendo mais acima,
  // a lista fica parada e aparece a pílula (spec da F03, "Rolagem e pílula").
  const newestSaved = saved.at(-1);
  const newestSavedId = newestSaved?.id;
  const newestSavedClientId = newestSaved?.clientId;
  const seenNewest = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const previous = seenNewest.current;
    seenNewest.current = newestSavedId;
    if (previous === undefined) return scrollToEnd();
    if (!newestSavedId || newestSavedId <= previous) return;
    if (newestSavedClientId && sentHere.current.has(newestSavedClientId)) return;
    // Indo até a Mensagem citada, a Mensagem nova não puxa a lista para o fim.
    if (isAtEnd.current && !isJumping.current) scrollToEnd();
    else setHasNewBelow(true);
  }, [newestSavedId, newestSavedClientId, scrollToEnd]);

  // Tentar de novo também é um envio desta aba: a lista vai ao fim, como no primeiro envio.
  function retryAndFollow(message: PendingMessage) {
    retry(message);
    scrollToEnd();
  }

  // A pílula leva ao fim e passa o foco ao histórico, porque ela some.
  function goToNewMessages() {
    scrollToEnd();
    scrollRef.current?.focus();
  }

  // Rola até a Mensagem, no centro, e a destaca por 2 s.
  const showMessage = useCallback((messageId: string) => {
    anchor.current = null;
    listRef.current
      ?.querySelector(`[data-message-id="${messageId}"]`)
      ?.scrollIntoView({ block: "center" });
    setHighlightedId(messageId);
  }, []);
  useEffect(() => {
    if (!highlightedId) return;
    const timer = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightedId]);

  // Uma Citação nova toma o lugar de uma ida em andamento.
  function goToMessage(messageId: string) {
    if (saved.some((message) => message.id === messageId)) {
      isJumping.current = false;
      setJumpTarget(null);
      return showMessage(messageId);
    }
    isJumping.current = true;
    jumpRequestedLoad.current = false;
    setJumpTarget(messageId);
  }

  // Sem a original na lista, carrega as páginas anteriores, maiores, até achá-la ou até saber que
  // ela não está mais lá.
  const step = jumpTarget ? jumpStep(saved, jumpTarget, hasOlder) : null;
  const advanceJump = useEffectEvent(() => {
    if (!jumpTarget || !step) return;
    if (step === "continue") {
      if (isLoadingOlder) return;
      if (olderFailed && jumpRequestedLoad.current) {
        isJumping.current = false;
        setJumpTarget(null);
        toast.error("Não foi possível ir até a mensagem.");
        return;
      }
      jumpRequestedLoad.current = true;
      loadOlder(JUMP_PAGE_SIZE);
      return;
    }
    isJumping.current = false;
    setJumpTarget(null);
    if (step === "found") showMessage(jumpTarget);
    else toast("A mensagem não está mais disponível");
  });
  const advanceSeek = useEffectEvent(() => {
    if (!isSeekingUnread) return;
    const lastReadId = dividerAfter?.lastReadId ?? null;
    if (!needsOlderForUnread(saved, lastReadId, hasOlder) || (olderFailed && seekRequestedLoad.current)) {
      isJumping.current = false;
      setSeekingUnread(false);
      return;
    }
    if (isLoadingOlder) return;
    isJumping.current = true;
    seekRequestedLoad.current = true;
    loadOlder(JUMP_PAGE_SIZE);
  });
  useEffect(() => {
    if (!isSeekingUnread) return;
    const frame = requestAnimationFrame(() => advanceSeek());
    return () => cancelAnimationFrame(frame);
  }, [isSeekingUnread, firstId, hasOlder, isLoadingOlder, olderFailed]);

  // Posiciona uma vez, ao abrir: a lista já abre no fim, e o divisor que ficou acima da área
  // visível rola para o topo dela.
  const isPositioned = useRef(false);
  useLayoutEffect(() => {
    if (isPositioned.current || isSeekingUnread || !firstUnread) return;
    isPositioned.current = true;
    const element = scrollRef.current;
    const divider = listRef.current?.querySelector("[data-unread-divider]");
    if (!element || !divider) return;
    if (divider.getBoundingClientRect().top < element.getBoundingClientRect().top) {
      anchor.current = null;
      divider.scrollIntoView({ block: "start" });
      measureEnd();
    }
  }, [isSeekingUnread, firstUnread, measureEnd]);

  // A cada página que chega (ou falha), o próximo passo da ida, no quadro seguinte, depois de a lista
  // nova estar na tela.
  useEffect(() => {
    if (!jumpTarget) return;
    const frame = requestAnimationFrame(() => advanceJump());
    return () => cancelAnimationFrame(frame);
  }, [jumpTarget, step, isLoadingOlder, olderFailed]);

  // Quando a página anterior entra no começo, a Mensagem que a Pessoa lia fica no mesmo lugar: a
  // rolagem é devolvida pela posição da âncora, sem depender do overflow-anchor do navegador.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    const saved = anchor.current;
    anchor.current = null;
    if (!element || !saved) return;
    const bottom = anchorBottom(element, saved.id);
    if (bottom !== null) element.scrollTop += bottom - saved.bottom;
  }, [firstId]);

  // Uma carga que falhou não devolve a rolagem depois.
  useEffect(() => {
    if (olderFailed) anchor.current = null;
  }, [olderFailed]);

  // Quem pediu as anteriores pelo teclado não perde o foco quando a última página chega e o botão
  // dá lugar ao começo do Canal: o foco vai para a área do histórico.
  const loadOlderButtonRef = useRef<HTMLButtonElement>(null);
  const hadButtonFocus = useRef(false);
  useLayoutEffect(() => {
    if (!hasOlder && hadButtonFocus.current) scrollRef.current?.focus();
    hadButtonFocus.current = false;
  }, [hasOlder]);

  function requestOlder() {
    const element = scrollRef.current;
    const bottom = element && firstId ? anchorBottom(element, firstId) : null;
    anchor.current = firstId && bottom !== null ? { id: firstId, bottom } : null;
    hadButtonFocus.current = document.activeElement === loadOlderButtonRef.current;
    loadOlder();
  }
  const onSentinelVisible = useEffectEvent(requestOlder);

  // O sentinela no topo pede a página anterior quando chega perto da área visível. Depois de uma
  // falha, ele espera o link. O observer é recriado a cada vez que volta a observar, o que já
  // confere de novo se o sentinela está à vista.
  const canObserve = hasOlder && !isLoadingOlder && !olderFailed;
  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!canObserve || !root || !sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onSentinelVisible();
      },
      { root, rootMargin: `${LOAD_OLDER_MARGIN_PX}px 0px 0px 0px` },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canObserve]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={measureEnd}
          role="region"
          aria-label={`Histórico de ${conversationTitle(conversation)}`}
          // Marca o histórico em dia com o tempo real, que os testes esperam antes de agir.
          data-synced={isSynced ? "" : undefined}
          tabIndex={0}
          className="group/history flex min-h-0 flex-1 flex-col overflow-y-auto pb-2"
        >
          <div className="mt-auto" />
          {hasOlder ? (
            <div ref={sentinelRef} className="flex h-12 shrink-0 items-center justify-center">
              {/* O botão fica montado durante a carga, para quem chegou pelo teclado não perder o
                  foco; só o conteúdo vira o indicador ("Conversa / Lista / Carregando anteriores"). */}
              <button
                ref={loadOlderButtonRef}
                type="button"
                onClick={requestOlder}
                aria-busy={isLoadingOlder}
                className={buttonVariants({ variant: "link", className: "text-small" })}
              >
                {isLoadingOlder ? (
                  <span className="text-fg-muted">
                    <Spinner size="md" />
                    <span className="sr-only">Carregando mensagens anteriores</span>
                  </span>
                ) : (
                  "Carregar mensagens anteriores"
                )}
              </button>
            </div>
          ) : (
            <ConversationIntro conversation={conversation} selfId={currentPerson.id} />
          )}
          <ol ref={listRef} aria-label={`Mensagens em ${conversationTitle(conversation)}`} className="flex flex-col">
            {rows.map(({ message, compact, dayLabel }) => (
              <MessageItem
                // Pela autora e pelo client_id, a Mensagem "enviando" vira a gravada no mesmo item.
                key={`${message.author.id}:${message.clientId}`}
                message={message}
                timeZone={timeZone}
                compact={compact}
                dayLabel={dayLabel}
                unreadDivider={message.id === firstUnread}
                status={message.status ?? "sent"}
                currentPersonId={currentPerson.id}
                onGoToQuote={goToMessage}
                highlighted={highlightedId === message.id}
                onReply={
                  message.status
                    ? undefined
                    : () => {
                        setQuoting(message);
                        composerRef.current?.focus();
                      }
                }
                onRetry={message.status ? () => retryAndFollow(message as PendingMessage) : undefined}
                onDiscard={message.status ? () => discard(message.clientId) : undefined}
                failure={message.status ? (message as PendingMessage).failure : undefined}
                edit={
                  message.author.id === currentPerson.id && !message.status
                    ? {
                        isEditing: editingId === message.id,
                        start: () => setEditingId(message.id),
                        onSaved: applyEdited,
                        onClose: () => closeEdit(message.id),
                        onDeleted: () => deleteAndMoveFocus(message.id),
                      }
                    : undefined
                }
              />
            ))}
          </ol>
        </div>
        {jumpTarget || isSeekingUnread ? (
          <div className="absolute left-1/2 top-2 -translate-x-1/2" role="status">
            <span className="flex animate-pop-in items-center gap-2 rounded-pill border border-border bg-surface-raised px-3 py-1 text-small text-fg shadow-2">
              <Spinner size="sm" />
              Indo até a mensagem…
            </span>
          </div>
        ) : null}
        {hasNewBelow ? (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <NewMessagesPill onClick={goToNewMessages} />
          </div>
        ) : null}
      </div>
      <TypingIndicator conversationId={conversation.id} />
      <MessageComposer
        inputRef={composerRef}
        conversationId={conversation.id}
        quoting={quoting && { authorName: quoting.author.name, body: quoting.body }}
        onCancelQuote={() => setQuoting(null)}
        label={composerLabel(conversation, currentPerson.id)}
        onTextChange={typing.onTextChange}
        onSend={(body) => {
          send(body, quoting ?? undefined);
          setQuoting(null);
        }}
      />
    </div>
  );
}

// Posição do fim da Mensagem em relação ao topo da área de rolagem.
function anchorBottom(container: HTMLElement, messageId: string): number | null {
  const item = container.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!item) return null;
  return item.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
}
