// O texto do Agente nos blocos do AgentText (spec da F11, "Cliente"; design system, "AgentText"):
// o subconjunto de Markdown que o Agente escreve (`#`, listas com `-`, parágrafos e **negrito**).
// O que não é reconhecido fica como texto num parágrafo, e nada vira HTML nem link: os blocos só
// carregam texto, que o componente renderiza como dado.

export type AgentSpan = { text: string; bold: boolean };

export type AgentBlock =
  | { kind: "heading"; spans: AgentSpan[] }
  | { kind: "list"; items: AgentSpan[][] }
  | { kind: "paragraph"; spans: AgentSpan[] };

const HEADING = /^#{1,3} (.*)$/;
const LIST_ITEM = /^- (.*)$/;

export function parseAgentText(text: string): AgentBlock[] {
  const blocks: AgentBlock[] = [];
  let paragraph: string[] = [];
  const closeParagraph = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", spans: parseSpans(paragraph.join("\n")) });
    paragraph = [];
  };
  for (const line of text.split("\n")) {
    const heading = HEADING.exec(line);
    const item = LIST_ITEM.exec(line);
    if (line.trim() === "") {
      closeParagraph();
    } else if (heading) {
      closeParagraph();
      blocks.push({ kind: "heading", spans: parseSpans(heading[1].trim()) });
    } else if (item) {
      closeParagraph();
      const last = blocks.at(-1);
      const spans = parseSpans(item[1].trim());
      if (last?.kind === "list") last.items.push(spans);
      else blocks.push({ kind: "list", items: [spans] });
    } else {
      // Uma linha comum logo depois de uma lista começa outro bloco, e não continua o item.
      paragraph.push(line);
    }
  }
  closeParagraph();
  return blocks;
}

// O negrito por **…** com par; um ** sem par fica como está.
function parseSpans(text: string): AgentSpan[] {
  const spans: AgentSpan[] = [];
  const bold = /\*\*(.+?)\*\*/g;
  let index = 0;
  for (const match of text.matchAll(bold)) {
    if (match.index > index) spans.push({ text: text.slice(index, match.index), bold: false });
    spans.push({ text: match[1], bold: true });
    index = match.index + match[0].length;
  }
  if (index < text.length) spans.push({ text: text.slice(index), bold: false });
  return spans;
}
