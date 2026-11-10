import { AtSign, BellOff, MessageSquare } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { ActivityFilter } from "@/app/services/chat-api";

// O vazio de cada aba, como os frames "Atividade / Vazio em ...". O de Todas não fala de Tarefas,
// que entram na F12.
const EMPTY = {
  all: { icon: BellOff, description: "Menções e mensagens diretas aparecem aqui assim que chegam." },
  mentions: { icon: AtSign, description: "Quando alguém mencionar você com @, a mensagem aparece aqui." },
  direct: { icon: MessageSquare, description: "Novas mensagens diretas aparecem aqui." },
} as const;

export function ActivityEmpty({ filter }: { filter: ActivityFilter }) {
  const { icon, description } = EMPTY[filter];
  return (
    <div className="flex justify-center">
      <EmptyState icon={icon} title="Tudo em dia" description={description} />
    </div>
  );
}
