# Plano da F10-T09: Mencionar um Agente conectado

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas, seção "Conversa") e encontra
"Conversa / Composer / Lista de menções com Agente", com o Agente depois dos Membros (MentionOption
`Kind=agent`), e "Conversa / Mensagem / Menção a Agente", com o `AgentMentionChip` no tom de
Menção a outra Pessoa, nos temas claro e escuro.

### CA2

**Marca:** teste de unidade

**Cenário:** `agentMentionOptions(agents, query)` devolve só os Agentes conectados cujo `name` ou
`username` começa pelo texto (sem diferenciar maiúsculas e acentos), na ordem da lista, e nenhum
com a lista indisponível (`null`); escolher um Agente insere `@<username>` (provado no Playwright
da CA6).

**Teste previsto:** Vitest, `src/app/utils/agent-mentions.test.ts`.

### CA3

**Marca:** teste de unidade

**Cenário:** `splitMessageBody(texto, menções, usernamesDeAgentes)` devolve um segmento `agent` para
`@assistente` quando `assistente` está na lista; não reconhece `@assistente2`, `x@assistente` nem
`@assistente.com`, pela regra de limite de palavra das Menções gravadas; com uma Menção gravada e um
Agente com o mesmo `@usuário`, devolve a Menção à Pessoa; sem a lista, `@assistente` é texto.

**Teste previsto:** Vitest, `src/app/utils/message-segments.test.ts`.

### CA4

**Marca:** teste no Playwright

**Cenário:** O `AgentMentionChip` é um botão com o nome acessível "Agente Assistente (@assistente)",
nas cores `mention-bg` e `mention-fg`, e Enter nele abre o diálogo "Agentes".

**Teste previsto:** Playwright, `e2e/agentes/mencionar-agente.spec.ts`.

### CA5

**Marca:** teste HTTP

**Cenário:** Dado o bot `assistente` no Banco do chat, quando uma Pessoa envia "Oi @assistente" num
Canal, então a Mensagem volta com `mentions` vazio, nenhuma Notificação é gravada e as Não lidas do
Canal não ganham Menção.

**Teste previsto:** e2e da API, `test/messages-mentions.e2e-spec.ts`, "não grava Menção a um bot".

### CA6

**Marca:** teste no Playwright

**Cenário:** Com o `assistente` conectado, `@ass` no composer mostra o Agente no autocompletar,
depois dos Membros e com o AgentAvatar; Enter o escolhe e insere `@assistente`; a Mensagem enviada
mostra o chip, também para a outra Pessoa; o chip abre o diálogo pelo teclado; depois de
desconectar, ao recarregar, o chip vira texto comum. O axe no autocompletar com o Agente, nos dois
temas, não acha violações.

**Teste previsto:** Playwright, `e2e/agentes/mencionar-agente.spec.ts` e
`e2e/acessibilidade/mencionar-agente-sem-violacoes.spec.ts`.

### CA7

**Marca:** teste no Playwright

**Cenário:** A 08 está concluída: depois de desconectar, o chip vira texto comum para a outra
Pessoa sem recarregar.

**Teste previsto:** Playwright, `e2e/agentes/mencionar-agente.spec.ts`, "o chip vira texto comum
sem recarregar".

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o autocompletar com o
Agente e o chip numa Mensagem, nos dois temas, ao lado dos frames.

## Contrato

O contrato não muda: a Menção a um Agente é reconhecida só no cliente.

## Verificação do contrato

Nenhum item.

## Decisões

- **Opções do autocompletar.** `useMentionPicker` passa a devolver opções `{ kind: "person" }` e
  `{ kind: "agent" }`: as Pessoas da busca e, depois delas, `agentMentionOptions(agents, query)`,
  só quando a busca do texto atual respondeu (como hoje), para Enter não escolher uma opção que
  ainda não corresponde ao texto. O `MentionPicker` mostra o Agente com o AgentAvatar `xs` sobre
  `sidebar` e "@usuário · Agente" no detalhe.
- **AgentAvatar.** Ganha a prop `surface` do Figma (`field`, na barra lateral; `default`, sobre
  `sidebar`), e o `xs` passa a aceitar as duas.
- **Destaque.** `splitMessageBody` recebe `agentUsernames` e devolve `{ kind: "agent", text,
  username }`. O `MessageBody` lê os conectados por `useConnectedAgentUsernames()`, que devolve
  lista vazia fora do `AgentsProvider` e com a lista indisponível.
- **Diálogo aberto de qualquer lugar.** O estado do diálogo "Agentes" sobe para o `AgentsProvider`,
  que ganha `personId` e `isAdmin` e renderiza o diálogo; `useAgents()` expõe
  `openAgentsDialog(opener)`. A seção da barra lateral e o chip o abrem, e o foco volta a quem
  abriu. Assim o chip funciona também com a gaveta fechada, abaixo de 768 px.
- **Nome acessível do chip.** "Agente Assistente (@assistente)", com o nome do catálogo, para o
  leitor de tela distinguir o Agente de uma Pessoa.

## Arquivos e interfaces

- `apps/web/src/app/utils/agent-mentions.ts` (+ teste): `agentMentionOptions`.
- `apps/web/src/app/utils/message-segments.ts` (+ teste): o segmento `agent`.
- `apps/web/src/app/hooks/use-mention-picker.ts`: as opções com Agentes.
- `apps/web/src/app/components/message/mention-picker.tsx`: a opção de Agente.
- `apps/web/src/app/components/message/agent-mention-chip.tsx`: novo.
- `apps/web/src/app/components/message/message-body.tsx`: o chip do Agente.
- `apps/web/src/app/components/agent/agents-provider.tsx`, `agents-section.tsx` e
  `agent-avatar.tsx`: o diálogo no provider e a `surface`.
- `apps/web/src/app/(app)/layout.tsx`: `personId` e `isAdmin` no `AgentsProvider`.
- `apps/chat-api/test/messages-mentions.e2e-spec.ts`: o caso do bot.
- `apps/web/e2e/agentes/mencionar-agente.spec.ts`,
  `apps/web/e2e/acessibilidade/mencionar-agente-sem-violacoes.spec.ts` e o plano de testes.

## Testes existentes que mudam

- `src/app/utils/message-segments.test.ts`: casos novos; os que existem seguem iguais, com a
  lista de Agentes vazia por padrão.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano.
