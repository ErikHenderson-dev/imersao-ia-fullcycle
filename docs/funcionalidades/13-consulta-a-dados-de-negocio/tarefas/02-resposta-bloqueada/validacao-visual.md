# Validação visual da F13-T02

2026-11-12 · 1440 × 900 · `docs/design-system.md`, "Validação visual"

A Conversa com uma Resposta bloqueada e uma Mensagem que a cita, vista por quem não tem Permissão
de dados, comparada com os frames da seção "Consulta a dados (F13)" da página "Telas" do Figma:

| Tema | Código | Figma |
| --- | --- | --- |
| Claro | [citacao-bloqueada-claro.png](citacao-bloqueada-claro.png) | [figma-citacao-bloqueada-claro.png](figma-citacao-bloqueada-claro.png), `Conversa / Dados de negócio / Citação bloqueada` (207:58457) |
| Escuro | [citacao-bloqueada-escuro.png](citacao-bloqueada-escuro.png) | [figma-citacao-bloqueada-escuro.png](figma-citacao-bloqueada-escuro.png), `Conversa / Dados de negócio / Citação bloqueada (escuro)` (207:60829) |

O frame `Conversa / Dados de negócio / Resposta bloqueada` é a mesma Resposta bloqueada, sem a
Mensagem que cita, e fica coberto pela mesma captura.

## O que foi conferido

- **Resposta bloqueada:** o avatar, o nome e o AgentTag do Agente; no lugar do texto, o cadeado de
  16 px e o aviso "Resposta com dados de negócio. Você não tem permissão para vê-la." em `body` e
  `fg-muted`, com `gap-2` (camada `Restricted` do MessageItem); sem Respostas prontas.
- **Citação bloqueada:** a seta de 12 px, o nome do autor em negrito, o cadeado de 12 px e o aviso
  em `small` e `fg-muted`, com `gap-1` (ReplyQuote `Kind=restricted`), acima do texto da Mensagem.
- **Temas:** as mesmas cores semânticas nos dois, sem valor solto.

## Diferenças

- O nome do autor na citação usa `fg` no código, como a citação comum que já existe; o
  `Kind=restricted` do Figma usa `fg-muted`. A diferença é de tom num rótulo de 12 px e mantém a
  citação bloqueada igual à comum; fica registrada aqui, sem mudança.
- O aviso do componente no Figma ("Resposta com dados do negócio, visível só para quem tem
  acesso." e "Conteúdo restrito") foi trocado pelo texto da spec nos componentes MessageItem e
  ReplyQuote, antes do código.
