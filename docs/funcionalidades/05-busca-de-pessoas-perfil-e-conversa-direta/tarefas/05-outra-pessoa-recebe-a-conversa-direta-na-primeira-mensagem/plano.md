# Plano da F05-T05: A outra Pessoa recebe a Conversa direta na primeira Mensagem

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dada uma Conversa direta aberta por uma Pessoa, quando ela envia a primeira Mensagem,
então a outra Pessoa vira Membro; o reenvio da mesma Mensagem (mesmo `client_id`) não grava nada a
mais; na Conversa consigo mesma, nada muda.

**Teste previsto:** e2e da API, `test/conversations-direct.e2e-spec.ts`, "a primeira Mensagem torna
a outra Pessoa Membro", "o reenvio não grava nada a mais" e "na Conversa consigo mesma, a Mensagem
não grava participação".

### CA2

**Marca:** teste HTTP

**Cenário:** O mesmo do CA4, pelo lado da publicação: o `member_added` sai antes do
`message.created` e só quando a participação foi gravada agora.

**Teste previsto:** os do CA4.

### CA3

**Marca:** teste HTTP

**Cenário:** Antes da primeira Mensagem, a outra Pessoa recebe 404 na Conversa, no histórico e no
envio; depois dela, a Conversa entra na lista dela com o `counterpart` de quem escreveu.

**Teste previsto:** e2e da API, `test/conversations-direct.e2e-spec.ts`, "quem não é Membro recebe
404" (com o envio) e "depois da primeira Mensagem, a Conversa entra na lista da outra Pessoa".

### CA4

**Marca:** teste HTTP

**Cenário:** Com a outra Pessoa conectada, a primeira Mensagem lhe entrega o
`conversation.member_added` (com `person_ids` dela) e depois o `message.created`, nessa ordem; a
segunda Mensagem só o `message.created`; os dois voltam na reconexão com cursor, na mesma ordem;
antes da primeira Mensagem, ela não recebe o "digitando" de quem abriu.

**Teste previsto:** e2e da API, `test/realtime-conversations.e2e-spec.ts`, "a primeira Mensagem da
Conversa direta entrega o member_added e depois a Mensagem", "a segunda Mensagem só entrega a
Mensagem" e "os dois voltam na reconexão na mesma ordem"; `test/realtime-typing.e2e-spec.ts`, "a
outra Pessoa não recebe o digitando antes da primeira Mensagem".

### CA5

**Marca:** teste no Playwright

**Cenário:** Duas Pessoas em dois contextos: a Conversa aberta sem Mensagem não aparece para a
outra, nem pelo endereço ("Conversa não encontrada"); depois da primeira Mensagem, aparece na
barra lateral dela sem recarregar e sem abrir sozinha; e a resposta dela chega em tempo real.

**Teste previsto:** Playwright, `e2e/conversa-direta/primeira-mensagem.spec.ts`, "a Conversa só
aparece para a outra Pessoa na primeira Mensagem".

## Contrato

O contrato não muda: a rota de envio, a tabela de participação e os eventos já existem. Muda só
quando o `conversation.member_added` é publicado (spec da F05, "Tempo real"), o que os critérios
provam.

## Verificação do contrato

Nenhuma.

## Decisões

- **Envio numa transação:** o `MessagesService.send` passa a ter `@Transactional()`; a conferência
  de participação, a gravação da Mensagem e a da participação da outra Pessoa ficam juntas.
- **Participação da outra Pessoa:** `ConversationsService.joinDirectCounterpart(conversation,
  authorId)` grava, numa Conversa direta, a participação da Pessoa do par que não é o autor,
  tolerando a que já existe, e devolve se gravou agora. Na Conversa consigo mesma não há outra
  Pessoa, e nada é gravado. Só roda para uma Mensagem nova.
- **Publicação em ordem:** quando a participação foi gravada agora, o envio publica, uma depois da
  outra e sem prender a resposta, o `member_added` pelo `MembershipsService` (que passa a ser
  exportado e ganha `announceMemberAdded`, que devolve a promessa) e o `message.created`. O
  `MessagesModule` passa a importar o `MembershipsModule`.

## Arquivos e interfaces

- `apps/chat-api/src/messages/messages.service.ts` e `messages.module.ts`.
- `apps/chat-api/src/conversations/conversations.service.ts`: `joinDirectCounterpart`.
- `apps/chat-api/src/memberships/memberships.service.ts` e `memberships.module.ts`:
  `announceMemberAdded` e o export.
- `apps/web/e2e/conversa-direta/primeira-mensagem.spec.ts` e `e2e/plano-de-testes-f05.md`.

## Testes existentes que mudam

- `test/conversations-direct.e2e-spec.ts`: "quem não é Membro recebe 404" passa a conferir também
  o envio.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum. O LLD já registra a primeira Mensagem da Conversa direta como `planejada`.
