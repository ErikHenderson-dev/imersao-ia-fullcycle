# Plano da F04-T06: Remover Membro de Canal privado pelo comando

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de integração

**Cenário:** Dado um Canal privado com duas Membros, quando quem opera a instalação roda
`remove-member <nome> <e-mail>` com o e-mail da segunda, então o comando sai com 0, avisa
"<nome da Pessoa> saiu de #<nome>.", e a participação dela some. Nenhum evento é publicado: o
comando não sobe o tempo real.

**Teste previsto:** integração, `src/channels/channels.command.int-spec.ts`, "remove-member apaga a
participação da Pessoa no Canal privado".

### CA2

**Marca:** teste de integração

**Cenário:** Quando o Canal não existe, é público, o e-mail não tem conta ou a Pessoa não é Membro,
então o comando sai com 1, com uma mensagem que diz o motivo, e nada muda. Faltando argumento, ou
sobrando, mostra o uso.

**Teste previsto:** integração, `src/channels/channels.command.int-spec.ts`, "remove-member recusa
%s" (`it.each` com os quatro casos) e "remove-member mostra o uso sem os dois argumentos".

### CA3

**Marca:** teste de integração

**Cenário:** Depois da remoção, a Pessoa removida recebe `conversation_not_found` ao pedir a
Conversa pela conferência de participação.

**Teste previsto:** integração, `src/channels/channels.command.int-spec.ts`, no mesmo teste do CA1,
pela operação "Conversa da qual a Pessoa é Membro" do service.

### CA4

**Marca:** documento

**Cenário:** Quem revisa encontra `pnpm channels remove-member <nome> <e-mail>` na tabela "Comandos"
do `apps/chat-api/AGENTS.md`, com o que a operação faz.

## Contrato

O contrato não muda: o comando não é rota, evento nem tabela.

## Verificação do contrato

Nenhuma.

## Decisões

- `ConversationsService.removeMember(channelName, email)` normaliza o nome como o comando já faz,
  procura o Canal entre todos os tipos e a Pessoa pelo e-mail normalizado, e apaga a participação.
  As recusas são erros de domínio, que o comando imprime, como nas outras operações.
- Erros novos: `ChannelNotPrivateError` (Canal público) e `NotAMemberError` (Pessoa fora do Canal),
  os dois com o código `validation_failed`, porque só o comando os usa. Canal inexistente reaproveita
  o `ChannelNotFoundError`, e e-mail sem conta, o `PersonNotFoundError`.
- O comando não publica evento (spec da F04, "Comando de canais"): a Pessoa para de receber as
  Mensagens na hora, porque a publicação lê os Membros a cada envio.

## Arquivos e interfaces

- `apps/chat-api/src/conversations/conversations.service.ts`: `removeMember`.
- `apps/chat-api/src/conversations/channel-not-private.error.ts` e `not-a-member.error.ts`.
- `apps/chat-api/src/channels/channels.command.ts`: a operação e o uso.
- `apps/chat-api/AGENTS.md`, seção "Comandos".

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum.
