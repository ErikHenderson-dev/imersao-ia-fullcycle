import { useContext, useMemo } from "react";
import { AgentsContextForPicker } from "@/app/components/agent/agents-provider";
import type { Mention } from "@/app/services/chat-api";
import { formatTime } from "@/app/utils/format-time";
import { splitMessageBody } from "@/app/utils/message-segments";
import { AgentMentionChip } from "./agent-mention-chip";
import { MentionChip } from "./mention-chip";

// Texto da Mensagem como foi escrito, com as quebras de linha. Os endereços http(s) viram links,
// que abrem em outra aba, e os @usuário das Pessoas mencionadas viram Menções; nada mais vira
// marcação. A Mensagem editada leva "(editada)" no fim, com a hora da edição na dica (spec da F06,
// "Texto da Mensagem").
export function MessageBody({
  text,
  mentions = [],
  currentPersonId,
  edited,
  timeZone,
}: {
  text: string;
  mentions?: readonly Mention[];
  currentPersonId?: string;
  edited?: string | null;
  timeZone?: string;
}) {
  // Os Agentes conectados (spec da F10, "Menção a um Agente"); nenhum fora do AgentsProvider e com a
  // lista indisponível.
  const agents = useContext(AgentsContextForPicker)?.agents;
  const connected = useMemo(() => (agents ?? []).filter((agent) => agent.connected), [agents]);
  // A divisão só muda com o texto, as Menções e os Agentes, e não a cada renderização do histórico.
  const segments = useMemo(
    () => splitMessageBody(text, mentions, connected.map((agent) => agent.username)),
    [text, mentions, connected],
  );
  return (
    <p className="whitespace-pre-wrap break-words text-body text-fg">
      {segments.map((segment, index) =>
        segment.kind === "agent" ? (
          <AgentMentionChip
            key={index}
            text={segment.text}
            username={segment.username}
            name={connected.find((agent) => agent.username === segment.username)?.name ?? segment.username}
          />
        ) : segment.kind === "mention" ? (
          <MentionChip
            key={index}
            mention={segment.mention}
            text={segment.text}
            isSelf={segment.mention.id === currentPersonId}
          />
        ) : segment.kind === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-link hover:text-link-hover hover:underline"
          >
            {segment.href}
          </a>
        ) : (
          segment.text
        ),
      )}
      {edited && (
        <span
          title={`Editada às ${formatTime(edited, timeZone)}`}
          className="ml-1 text-caption text-fg-muted"
        >
          (editada)
        </span>
      )}
    </p>
  );
}
