import { formatTime } from "@/app/utils/format-time";
import { splitLinks } from "@/app/utils/message-links";

// Texto da Mensagem como foi escrito, com as quebras de linha. Só os endereços http(s) viram
// links, que abrem em outra aba; nada mais vira marcação. A Mensagem editada leva "(editada)" no
// fim, com a hora da edição na dica (spec da F06, "Texto da Mensagem").
export function MessageBody({
  text,
  edited,
  timeZone,
}: {
  text: string;
  edited?: string | null;
  timeZone?: string;
}) {
  return (
    <p className="whitespace-pre-wrap break-words text-body text-fg">
      {splitLinks(text).map((segment, index) =>
        segment.kind === "link" ? (
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
