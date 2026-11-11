import { parseAgentText, type AgentSpan } from "@/app/utils/agent-text";

// Texto do Agente (AgentText, Figma 153:44412): cabeçalho em `body/bold`, listas com marcador e
// parágrafos em `body/regular`, com `space/1` entre os blocos. O texto vem da função pura e é
// renderizado só como texto do React: nunca vira HTML nem link (design system, "AgentText").
export function AgentText({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-1 break-words text-body text-fg">
      {parseAgentText(text).map((block, index) =>
        block.kind === "heading" ? (
          <p key={index} className="font-bold">
            <Spans spans={block.spans} />
          </p>
        ) : block.kind === "list" ? (
          <ul key={index} className="flex flex-col gap-0.5 pl-2">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="flex gap-2">
                <span aria-hidden>•</span>
                <span>
                  <Spans spans={item} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            <Spans spans={block.spans} />
          </p>
        ),
      )}
    </div>
  );
}

function Spans({ spans }: { spans: AgentSpan[] }) {
  return spans.map((span, index) =>
    span.bold ? (
      <strong key={index} className="font-bold">
        {span.text}
      </strong>
    ) : (
      span.text
    ),
  );
}
