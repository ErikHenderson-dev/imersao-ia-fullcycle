"use client";

import { AtSign, SendHorizontal } from "lucide-react";
import { useId, useRef, useState } from "react";
import { MentionPicker } from "@/app/components/message/mention-picker";
import { useMentionPicker } from "@/app/hooks/use-mention-picker";
import { IconButton } from "@/app/components/ui/icon-button";
import { Kbd } from "@/app/components/ui/kbd";
import { insertAt } from "@/app/utils/mention-query";
import { overLimitBy, overLimitLabel } from "@/app/utils/message-text";

type MessageComposerProps = {
  // "Mensagem para #nome" e as variantes da Conversa direta ("conversation-title.ts"); sem ele
  // (Conversa ainda carregando), só "Mensagem".
  label?: string;
  // A cada mudança do texto, inclusive o esvaziamento depois do envio: o aviso de "digitando".
  onTextChange?: (text: string) => void;
  // A caixa de texto, para quem precisa pôr o foco nela (depois de apagar a última Mensagem).
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  // A Conversa da lista de menções (spec da F06); sem ela, a caixa não tem a lista nem o botão @.
  conversationId?: string;
} & (
  | {
      // Recebe o texto já sem as pontas; a lista mostra a Mensagem como "enviando" e a fila a
      // grava.
      onSend: (body: string) => void;
      disabled?: false;
    }
  // Desabilitada enquanto o histórico carrega, ou quando ele falhou.
  | { onSend?: undefined; disabled: true }
);

// Caixa de mensagem (MessageComposer): Enter envia e Shift+Enter quebra a linha. Acima do limite,
// o contador toma o lugar da dica e o envio fica bloqueado. O `@` abre a lista de menções, também
// pelo botão @ (spec da F06, "Lista de menções").
export function MessageComposer({
  label = "Mensagem",
  onTextChange,
  inputRef,
  conversationId,
  onSend,
  disabled,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const localRef = useRef<HTMLTextAreaElement>(null);
  const textarea = inputRef ?? localRef;
  // Troca o texto (escolha na lista, botão @) e põe o cursor na posição, depois de renderizar.
  function replaceText(value: string, caret: number) {
    changeText(value);
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(caret, caret);
      mentions.onCaret(caret);
    });
  }
  const mentions = useMentionPicker({
    conversationId: conversationId ?? "",
    text: conversationId ? text : "",
    replaceText,
  });
  const body = text.trim();
  const overLimit = overLimitBy(body);
  const canSend = !disabled && body !== "" && overLimit <= 0;
  // O contador fica ligado à caixa: o leitor de tela o lê com ela, sem anunciar cada tecla.
  const counterId = useId();

  function changeText(value: string) {
    setText(value);
    onTextChange?.(value);
  }

  function submit() {
    if (!canSend) return;
    onSend?.(body);
    changeText("");
  }

  return (
    <div className="shrink-0 px-5 pb-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="relative flex flex-col rounded-card border border-border-strong bg-surface focus-within:outline-2 focus-within:outline-focus"
      >
        {mentions.list && <MentionPicker {...mentions.list} />}
        <div className="flex px-3 pt-3 pb-1">
          <textarea
            ref={textarea}
            {...(conversationId ? mentions.inputProps : {})}
            aria-label={label}
            aria-invalid={overLimit > 0 || undefined}
            aria-describedby={overLimit > 0 ? counterId : undefined}
            placeholder={label}
            rows={1}
            autoFocus={!disabled}
            disabled={disabled}
            value={text}
            onChange={(event) => {
              changeText(event.target.value);
              mentions.onCaret(event.target.selectionStart);
            }}
            onSelect={(event) => mentions.onCaret(event.currentTarget.selectionStart)}
            onKeyDown={(event) => {
              if (mentions.onKeyDown(event)) return;
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
              }
            }}
            className="field-sizing-content max-h-60 min-h-[22px] flex-1 resize-none bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex items-center justify-end gap-3 p-1.5">
          {conversationId && (
            <IconButton
              icon={AtSign}
              label="Mencionar alguém"
              size="sm"
              className="mr-auto"
              disabled={disabled}
              onClick={() => {
                const caret = textarea.current?.selectionStart ?? text.length;
                const next = insertAt(text, caret);
                replaceText(next.text, next.caret);
              }}
            />
          )}
          {overLimit > 0 ? (
            <p id={counterId} className="text-caption text-danger-fg">
              {overLimitLabel(overLimit)}
            </p>
          ) : (
            <p className="hidden items-center gap-1 text-caption text-fg-muted sm:flex">
              <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd>
              <span>para nova linha</span>
            </p>
          )}
          <IconButton
            type="submit"
            icon={SendHorizontal}
            label="Enviar mensagem"
            size="sm"
            className="w-9"
            disabled={!canSend}
          />
        </div>
      </form>
    </div>
  );
}
