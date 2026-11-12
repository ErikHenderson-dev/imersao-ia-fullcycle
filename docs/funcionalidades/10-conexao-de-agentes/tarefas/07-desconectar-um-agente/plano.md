# Plano da F10-T07: Desconectar um Agente

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas, seção "Diálogos da casca") e
encontra "Diálogos / Desconectar agente / Erro ao desconectar", com o diálogo do administrador e o
Toast de erro "Não foi possível desconectar o agente", nos temas claro e escuro.

### CA2

**Marca:** teste de integração

**Cenário:** `DELETE /v1/agents/assistente/connection` com `is_admin: true` responde 204 e deixa o
`assistente` desconectado; repetido, responde 204. Sem a credencial, 401; sem `is_admin`, 403,
também fora do catálogo; fora do catálogo com `is_admin`, 404; com o corpo inválido, 400.

**Teste previsto:** integração, `tests/integration/test_connection_routes.py`, os casos do
`DELETE`, parametrizados com os do `PUT`.

### CA3

**Marca:** teste no Playwright

**Cenário:** `disconnectAgent` segue a `connectAgent`, pela mesma função: dado um administrador que
perdeu o papel com a tela aberta, confirmar mostra "Só administradores desconectam agentes" e o
Agente continua conectado; dada a Server Action falhando, a confirmação fecha, o toast "Não foi
possível desconectar o agente" aparece e o Agente continua conectado.

**Teste previsto:** Playwright, `e2e/agentes/desconectar-agente.spec.ts`, "a falha mantém o Agente
conectado" e "quem perdeu o papel recebe o erro".

### CA4

**Marca:** teste no Playwright

**Cenário:** "Desconectar" abre o ConfirmDialog "Desconectar Assistente?", com o texto do frame e o
foco em "Cancelar"; Esc e "Cancelar" fecham sem mudar nada; "Desconectar" mostra "Enviando" (o
botão ocupado e "Cancelar" desabilitado), fecha e mostra o Agente com "Conectar" no diálogo e fora
da barra lateral.

**Teste previsto:** Playwright, `e2e/agentes/desconectar-agente.spec.ts`, "o administrador
desconecta pelo teclado".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado o `assistente` conectado e uma Mensagem antiga que o menciona, quando o
administrador o desconecta pelo teclado, então a Mensagem continua visível, e a outra Pessoa, ao
recarregar, não vê mais a linha do Agente. O axe na confirmação, nos dois temas, não acha
violações.

**Teste previsto:** Playwright, `e2e/agentes/desconectar-agente.spec.ts` e
`e2e/acessibilidade/desconectar-agente-sem-violacoes.spec.ts`.

### CA6

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra a confirmação (Padrão
e Enviando) e o erro ao desconectar, nos dois temas, ao lado dos frames.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `roteiro-manual.md`, nesta pasta, e encontra a nota de Acessibilidade
do Lighthouse nos dois temas, com o diálogo "Agentes" aberto como administrador e como quem não
administra, e como foi medido.

## Contrato

### `DELETE /v1/agents/{slug}/connection` · nova

- Os mesmos itens do `PUT` (F10-T06): autenticação, `slug`, corpo `{ person_id, is_admin }`, 204
  inclusive se já estava desconectado, e os erros 401, 403, 404 e 400 na mesma ordem.

### Server Action `disconnectAgent(slug)` (BFF) · nova

- Os mesmos passos e a mesma união de resultado da `connectAgent`, com `DELETE`.

## Verificação do contrato

- `DELETE` 204, repetido, e os erros: CA2.
- `disconnectAgent`: `forbidden` e `failure`, CA3; `ok`, CA4 e CA5.

## Decisões

- **Mesma conferência das duas rotas.** O `DELETE` usa `_require_admin_and_agent` e
  `disconnect(engine, slug)`, que faz `DELETE` sem conferir se a linha existia.
- **Confirmação.** `DisconnectAgentDialog`, em `components/agent/disconnect-agent-dialog.tsx`, com o
  `ConfirmDialog` do design system: título "Desconectar <nome>?", a descrição do frame com o
  `@usuário`, confirmar "Desconectar" (danger) e "Enviando" pelo `isConfirming`. Na falha e no
  `forbidden`, a confirmação fecha e o toast aparece, como diz a spec; o texto do `forbidden` é
  "Só administradores desconectam agentes", no padrão do de conectar.
- **Foco depois de desconectar.** A linha troca "Desconectar" por "Conectar", e o foco vai para o
  "Conectar" da mesma linha, porque o botão que abriu a confirmação some.
- **Mensagens do Agente.** Na F10 nenhum Agente grava Mensagem (o bot como autor é da F11), então
  o Playwright prova que uma Mensagem antiga que menciona o Agente continua visível depois de
  desconectar, e não uma Mensagem de autoria dele.
- **Lighthouse.** Medido como na F09-T05: Lighthouse num *user flow* (modo Snapshot, só
  Accessibility) no Chromium do contêiner `e2e`, contra o build de produção, com o resultado e o
  método no roteiro.

## Arquivos e interfaces

- `apps/agents/app/registry/store.py`: `disconnect(engine, slug)`.
- `apps/agents/app/registry/routes.py`: `DELETE /v1/agents/{slug}/connection`.
- `apps/agents/tests/integration/test_connection_routes.py`: os casos do `DELETE`.
- `apps/web/src/app/actions/agent-connection.ts`: `disconnectAgent`.
- `apps/web/src/app/components/agent/disconnect-agent-dialog.tsx`: novo.
- `apps/web/src/app/components/agent/agents-dialog.tsx`: "Desconectar" abre a confirmação.
- `apps/web/e2e/agentes/desconectar-agente.spec.ts`,
  `apps/web/e2e/acessibilidade/desconectar-agente-sem-violacoes.spec.ts` e o plano de testes.

## Testes existentes que mudam

- `tests/integration/test_connection_routes.py`: os casos de erro passam a valer para os dois
  métodos.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano.
