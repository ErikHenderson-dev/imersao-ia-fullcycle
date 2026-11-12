"use client";

import { useOpenAgentsDialog } from "@/app/components/agent/agents-provider";

type AgentMentionChipProps = {
  // O texto como foi escrito ("@assistente") e o nome do Agente no catálogo.
  text: string;
  name: string;
  username: string;
};

// A Menção a um Agente conectado (AgentMentionChip; spec da F10, "Menção a um Agente"), no tom de
// Menção a outra Pessoa. Abre o diálogo "Agentes" ao clicar ou com Enter.
export function AgentMentionChip({ text, name, username }: AgentMentionChipProps) {
  const openAgentsDialog = useOpenAgentsDialog();
  return (
    <button
      type="button"
      aria-label={`Agente ${name} (@${username})`}
      onClick={(event) => openAgentsDialog?.(event.currentTarget)}
      className="rounded-item bg-mention-bg px-0.5 font-bold text-mention-fg hover:underline"
    >
      {text}
    </button>
  );
}
