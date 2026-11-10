import { useMemo } from "react";
import type { Mention } from "@/app/services/chat-api";
import { formatTime } from "@/app/utils/format-time";
import { splitMessageBody } from "@/app/utils/message-segments";
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
  // A divisão só muda com o texto e as Menções, e não a cada renderização do histórico.
  const segments = useMemo(() => splitMessageBody(text, mentions), [text, mentions]);
  return (
    <p className="whitespace-pre-wrap break-words text-body text-fg">
      {segments.map((segment, index) =>
        segment.kind === "mention" ? (
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
