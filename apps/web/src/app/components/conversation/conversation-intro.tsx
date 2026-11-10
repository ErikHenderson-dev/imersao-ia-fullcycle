import { Avatar } from "@/app/components/ui/avatar";
import type { Conversation } from "@/app/services/chat-api";
import { ChannelIcon } from "./channel-icon";

type ConversationIntroProps = {
  conversation: Pick<Conversation, "kind" | "name" | "topic" | "counterpart">;
  // A Pessoa da Sessão: a Conversa consigo mesma tem o próprio texto.
  selfId: string;
};

// Começo da Conversa (ConversationIntro): aparece acima da primeira Mensagem, ou sozinho numa
// Conversa sem Mensagens. No Canal, "Conversa / Lista / Início do canal"; na Conversa direta,
// "Início da conversa direta" e "Início da conversa consigo mesma" (spec da F05).
export function ConversationIntro({ conversation, selfId }: ConversationIntroProps) {
  const { name, topic, kind, counterpart } = conversation;
  if (kind === "direct" && counterpart) {
    return (
      <div className="flex flex-col items-start gap-1 px-5 pt-8 pb-4">
        <Avatar initials={counterpart.initials} seed={counterpart.id} className="mb-2 size-12" />
        <h2 className="text-title font-black text-fg">
          {counterpart.id === selfId
            ? "Este é o seu espaço. Guarde lembretes e rascunhos aqui; só você vê."
            : `Este é o começo da sua conversa direta com ${counterpart.name}.`}
        </h2>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1 px-5 pt-8 pb-4">
      <span className="mb-2 flex size-12 items-center justify-center rounded-card bg-surface-inset text-fg">
        <ChannelIcon kind={kind} size={24} />
      </span>
      <h2 className="text-title font-black text-fg">Este é o começo do canal #{name}</h2>
      {topic && <p className="text-body text-fg-muted">{topic}</p>}
    </div>
  );
}
