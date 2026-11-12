# Plano da F13-T01: Permissão de dados na Pessoa e no Pedido

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dado o Banco do chat migrado, quando uma Pessoa é criada sem mais nada, então a Pessoa
da Sessão dela traz `data_access` `false`, que é o padrão da coluna nova.

**Teste previsto:** e2e da API, `test/sessions.e2e-spec.ts`, os casos que já conferem a Pessoa da
Sessão com `toEqual`, agora com `data_access: false`.

### CA2

**Marca:** teste de integração

**Cenário:** Dado a Ana sem Permissão de dados, quando quem opera roda `set-data-access` com o
e-mail dela e `on`, então o comando imprime "Ana Souza agora tem Permissão de dados." e a coluna
fica verdadeira; com o `@usuário` e `off`, "deixou de ter"; repetido no mesmo valor, "já tinha" ou
"já não tinha", sem mudar o `updated_at`; com a Pessoa inexistente ou argumentos inválidos, sai 1
com o erro ou o uso; e o `USAGE` geral mostra a linha `set-data-access`.

**Teste previsto:** integração, `src/accounts/accounts.command.int-spec.ts`, `describe('set-data-access')`,
no molde dos casos de `set-admin`.

### CA3

**Marca:** teste HTTP

**Cenário:** Dado a Ana com Permissão de dados ligada depois de entrar, quando ela lê a Pessoa da
Sessão, então recebe `data_access: true`, lido do banco a cada requisição; e, quando outra Pessoa
abre o Perfil da Ana, o corpo não tem `data_access`.

**Teste previsto:** e2e da API, `test/sessions.e2e-spec.ts`, "traz data_access lido do banco a cada
requisição", e `test/people-profile.e2e-spec.ts`, o caso que já confere o Perfil com `toEqual`
(o campo ausente quebra a igualdade se aparecer).

### CA4

**Marca:** teste de unidade

**Cenário:** Dado o autor da Mensagem gravada e a Pessoa da Sessão, quando o BFF monta o
`requester` do Pedido, então ele leva `data_access` da Pessoa da Sessão; sem a Pessoa da Sessão
(falha da leitura), `data_access` é `false`.

**Teste previsto:** Vitest, `src/app/utils/agent-mentions.test.ts`, "o requester leva a Permissão
de dados da Pessoa da Sessão" e "sem a Pessoa da Sessão, o requester vai sem Permissão de dados".

### CA5

**Marca:** teste de unidade

**Cenário:** Dado o corpo do Pedido com `requester.data_access` `true`, quando o Serviço de agentes
monta o estado do Pedido, então o estado traz a Permissão de dados verdadeira; sem o campo, falsa;
e as instruções do `assistente`, montadas desse estado, não citam a Permissão de dados.

**Teste previsto:** unidade, `tests/unit/test_request_parts.py`, "o estado guarda a Permissão de
dados", "sem o campo a Permissão de dados é falsa" e "as instruções não mostram a Permissão de
dados".

### CA6

**Marca:** documento

**Cenário:** Quem revisa confere que os testes de CA1 a CA5 existem: o comando e a Pessoa da Sessão
na API do chat, e o corpo com e sem o campo no Serviço de agentes.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre o `AGENTS.md` raiz e acha o `set-data-access` no passo a passo do
bot e do administrador de desenvolvimento, e abre o LLD e acha `data_access` em "Dados" e
`requester.data_access` em "Interfaces" como `existe`.

## Contrato

### GET /v1/sessions/current · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Resposta de sucesso | 200 `{ person: { …, is_admin } }` | 200 `{ person: { …, is_admin, data_access: boolean } }` |

O mesmo `person` sai no `POST /v1/sessions` (login), que usa `toPersonResponse`.

### POST /v1/requests (Serviço de agentes) · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Corpo da requisição | `requester: { id, name, username }` | `requester: { id, name, username, data_access?: boolean }`, falso quando ausente |

### people · chat · alterada

| Coluna | Tipo | Nulo | Padrão | Observação |
| --- | --- | --- | --- | --- |
| `data_access` | `boolean` | não | `false` | nova; Permissão de dados (ADR 0015) |

## Verificação do contrato

- `GET /v1/sessions/current` com `data_access`: CA1 (padrão) e CA3 (ligada).
- `POST /v1/sessions` com `data_access`: coberto pelo mesmo `toPersonResponse`; os casos do login em
  `sessions.e2e-spec.ts` que conferem `person` com `toEqual` passam a esperar o campo (CA1).
- `POST /v1/requests` com e sem `data_access`: CA5.
- `people.data_access` com o padrão `false`: CA1.

## Decisões

- O BFF lê a Pessoa da Sessão com `getCurrentPerson(token)` em paralelo com as Menções e o fuso, e
  não tira a permissão do autor da Mensagem gravada, que não a traz. Se a leitura falhar, o Pedido
  vai com `data_access` `false`: na dúvida, sem acesso.
- O `requester` do Pedido sai de uma função pura nova, `agentRequester(author, session)`, ao lado de
  `agentRequestQuote`, para ser provada pelo Vitest sem subir o Next.
- No Serviço de agentes, a chave `context.DATA_ACCESS` entra no `request_state`; as instruções do
  `assistente` não a leem (só `MENTIONS` e quem pediu chegam ao modelo, como hoje).
- O `PeopleService.setDataAccess(personId, value)` segue o `setAdmin`: um `UPDATE … WHERE
  data_access <> :value`, que devolve se mudou, e o comando imprime pela resposta.

## Arquivos e interfaces

- API do chat:
  - `src/people/person.entity.ts`: `dataAccess: boolean`.
  - `src/people/people.service.ts`: `setDataAccess(personId, dataAccess): Promise<boolean>`, e o
    `dataAccess` no retorno de `insertIgnoringConflict`, se ele montar a Pessoa à mão.
  - `src/sessions/person.response.ts`: `data_access`.
  - `src/accounts/accounts.command.ts`: operação `set-data-access` e a linha no `USAGE`.
  - `migrations/1794500000000-AddPersonDataAccess.ts`.
  - `src/accounts/accounts.command.int-spec.ts`, `test/sessions.e2e-spec.ts`.
- Web:
  - `src/app/services/chat-api.ts`: `ApiPerson.data_access` e `Person.dataAccess`.
  - `src/app/services/agents-service.ts`: `AgentRequestPayload.requester.dataAccess`, enviado como
    `data_access`.
  - `src/app/utils/agent-mentions.ts`: `agentRequester(author, session)`.
  - `src/app/actions/send-message.ts`: lê a Pessoa da Sessão e usa `agentRequester`.
  - `src/app/utils/agent-mentions.test.ts`.
- Serviço de agentes:
  - `app/agent_requests/models.py`: `Requester.data_access: bool = False`.
  - `app/agent_requests/context.py`: `DATA_ACCESS`.
  - `app/agent_requests/execution.py`: `request_state` com `DATA_ACCESS`.
  - `tests/unit/test_request_parts.py`.
- `AGENTS.md` raiz e `apps/chat-api/AGENTS.md` (tabela de comandos): o `set-data-access`.

## Testes existentes que mudam

- `test/sessions.e2e-spec.ts`: os casos que conferem a Pessoa da Sessão com `toEqual` passam a
  esperar `data_access: false`, porque o campo é novo na resposta.

## Mudança de dados

Nenhuma: a migração dá `false` a quem já existe.

## Documentos atualizados

Nenhum no commit de plano: o LLD já registra `data_access` em "Dados" e `requester.data_access` em
"Interfaces" como `planejado` (planejamento da F13). No fim da tarefa, os dois passam a `existe`
pela skill `lld`.
