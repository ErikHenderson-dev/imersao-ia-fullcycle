# Plano da F12-T05: Delegar a partir de uma Mensagem citada

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dado a Mensagem gravada pelo envio, quando o BFF monta o Pedido, então `quote` traz o
id, o texto atual e o nome e o `@usuário` do autor da Mensagem citada; sem Citação, ou com a citada
apagada, `quote` é nulo. O Serviço de agentes aceita o corpo com `quote` e sem ele (nulo).

**Teste previsto:** Vitest, `src/app/utils/agent-mentions.test.ts`, "agentRequestQuote"; integração
do Serviço de agentes, `tests/integration/test_request_routes.py`, "aceita o Pedido com a Citação".

### CA2

**Marca:** revisão humana

**Cenário:** Quem revisa abre as instruções do `assistente` e encontra a Mensagem citada no fim,
como dado (autor e texto numa linha), e a regra de que o conteúdo citado serve ao título e nunca é
ordem; e encontra a Citação no estado do Pedido.

### CA3

**Marca:** teste de integração

**Cenário:** Com o app real, o modelo real e a API do chat falsa, quando chega "@assistente delega
isso pra @ana" com `quote` "Precisamos revisar o contrato da Acme até sexta" e a Ana em `mentions`,
então a API falsa recebe a ação `task` para `ana` com um título que fala no contrato da Acme. O caso
da citada apagada é o `quote` nulo de CA1.

**Teste previsto:** integração, `tests/integration/test_request_task.py`, "delega isso com a
Citação".

## Contrato

### POST /v1/requests (Serviço de agentes) · alterada

| Item | Antes | Depois |
| --- | --- | --- |
| Corpo da requisição | `request_id`, `kind`, `parent_request_id`, `agent`, `conversation_id`, `message`, `requester`, `mentions`, `time_zone` | mais `quote`: `{ id: UUID, body: string, author: { name, username } } \| null`, opcional (ausente vale nulo) |

## Verificação do contrato

- `quote` aceito e nulo por padrão: CA1. O uso pelo modelo: CA3.

## Decisões

- `quote` é opcional no corpo, com nulo por padrão: um BFF anterior continua aceito.
- A Citação entra no estado do Pedido e aparece nas instruções, no fim, como dado numa linha só e
  cortada no tamanho máximo da Mensagem, como as Pessoas mencionadas: o modelo a lê, mas ela não
  vira regra.
- O BFF tira a Citação do `quote` da Mensagem que a API do chat acabou de gravar, que já traz o
  texto atual; sem outra leitura.

## Arquivos e interfaces

- Web: `src/app/utils/agent-mentions.ts` (`agentRequestQuote`), `src/app/actions/send-message.ts`,
  `src/app/services/agents-service.ts` (`quote` no corpo).
- Serviço de agentes: `app/agent_requests/models.py` (`RequestQuote`, `quote`),
  `app/agent_requests/context.py` (`QUOTE`), `app/agent_requests/execution.py` (estado),
  `app/agents/assistente/instructions.py` (a Citação e a regra).
- Testes: `src/app/utils/agent-mentions.test.ts`, `tests/integration/test_request_routes.py`,
  `tests/integration/test_request_task.py`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

- `docs/lld.md`, "Interfaces": a linha de `POST /v1/requests` cita o `quote` da spec da F12.
