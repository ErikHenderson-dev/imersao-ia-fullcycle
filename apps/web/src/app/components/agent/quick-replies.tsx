"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/app/components/ui/button";
import type { QuickReplies as QuickRepliesData } from "@/app/services/chat-api";
import { quickRepliesState, type QuickRepliesState } from "@/app/utils/quick-replies";

// A linha abaixo dos botões em cada estado (Figma, Conversa / Mensagem / Pergunta do agente).
const STATE_TEXT: Record<QuickRepliesState, string> = {
  active: "Aguardando sua resposta",
  other_member: "Só quem pediu pode responder",
  closed: "Encerrada",
};

type QuickRepliesProps = {
  quickReplies: QuickRepliesData;
  currentPersonId: string;
  // O envio comum do texto do botão, como se a Pessoa o escrevesse (spec da F11, "Disparo pelo BFF").
  onSelect: (label: string) => void;
};

// As Respostas prontas da pergunta do Agente (spec da F11, "Cliente"): botões nativos, na ordem da
// Mensagem, que disparam com Enter e Espaço. Só quem pediu os usa, enquanto a pergunta vale; o
// vencimento desativa sem recarregar, e o encerramento chega pelo message.updated.
export function QuickReplies({ quickReplies, currentPersonId, onSelect }: QuickRepliesProps) {
  const now = useNowUntil(quickReplies.expiresAt);
  // Depois do clique, até o encerramento chegar, os botões não enviam de novo.
  const [chosen, setChosen] = useState(false);
  const state = quickRepliesState(quickReplies, currentPersonId, now);
  const isActive = state === "active" && !chosen;
  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-2 pt-2">
        {quickReplies.options.map((label) => (
          <button
            key={label}
            type="button"
            disabled={!isActive}
            aria-label={state === "other_member" ? `${label}, só quem pediu pode responder` : undefined}
            onClick={() => {
              setChosen(true);
              onSelect(label);
            }}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="flex items-center gap-1 pt-1 text-caption text-fg-muted">
        <Clock size={12} aria-hidden />
        {STATE_TEXT[state]}
      </p>
    </div>
  );
}

// A hora de agora, lida de novo no vencimento: os botões se desativam sem recarregar.
function useNowUntil(expiresAt: string): Date {
  const deadline = Date.parse(expiresAt);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    const timer = setTimeout(() => setNow(new Date()), remaining);
    return () => clearTimeout(timer);
  }, [deadline]);
  return now;
}
