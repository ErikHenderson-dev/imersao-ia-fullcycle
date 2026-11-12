import { MentionChip } from "@/app/components/message/mention-chip";
import type { Mention } from "@/app/services/chat-api";
import { parseAgentText, type AgentSpan } from "@/app/utils/agent-text";
import { splitMentionsOnly } from "@/app/utils/message-segments";

type AgentTextProps = {
  text: string;
  // As Pessoas que a Mensagem do bot menciona, resolvidas pela API (spec da F14, "Cliente (web)").
  mentions?: readonly Mention[];
  currentPersonId?: string;
};

// Texto do Agente (AgentText, Figma 153:44412): cabeçalho em `body/bold`, listas com marcador e
// parágrafos em `body/regular`, com `space/1` entre os blocos. O texto vem da função pura e é
// renderizado só como texto do React: nunca vira HTML nem link (design system, "AgentText"). As
// Menções que a API resolveu aparecem como as do texto de uma Pessoa.
export function AgentText({ text, mentions = [], currentPersonId }: AgentTextProps) {
  const spans = (items: AgentSpan[]) => (
    <Spans spans={items} mentions={mentions} currentPersonId={currentPersonId} />
  );
  return (
    <div className="flex flex-col gap-1 break-words text-body text-fg">
      {parseAgentText(text).map((block, index) =>
        block.kind === "heading" ? (
          <p key={index} className="font-bold">
            {spans(block.spans)}
          </p>
        ) : block.kind === "list" ? (
          <ul key={index} className="flex flex-col gap-0.5 pl-2">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>{spans(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {spans(block.spans)}
          </p>
        ),
      )}
    </div>
  );
}

function Spans({
  spans,
  mentions,
  currentPersonId,
}: {
  spans: AgentSpan[];
  mentions: readonly Mention[];
  currentPersonId?: string;
}) {
  return spans.map((span, index) => {
    const content = splitMentionsOnly(span.text, mentions).map((segment, segmentIndex) =>
      segment.kind === "mention" ? (
        <MentionChip
          key={segmentIndex}
          mention={segment.mention}
          text={segment.text}
          isSelf={segment.mention.id === currentPersonId}
        />
      ) : segment.kind === "text" ? (
        segment.text
      ) : null,
    );
    return span.bold ? (
      <strong key={index} className="font-bold">
        {content}
      </strong>
    ) : (
      <span key={index}>{content}</span>
    );
  });
}
