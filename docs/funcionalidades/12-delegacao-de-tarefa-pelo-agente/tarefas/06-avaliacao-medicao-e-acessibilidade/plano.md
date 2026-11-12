# Plano da F12-T06: Avaliação, medição e acessibilidade da delegação

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa encontra neste plano, em "Decisões", como os casos de delegação conferem o
`responsavel` e o `titulo` no `adk eval`, e de onde veio a decisão.

### CA2

**Marca:** revisão humana

**Cenário:** Quem revisa abre o evalset do `assistente` e encontra cerca de 18 casos de delegação nas
categorias da spec ("Decisões de teste", avaliação), o caso `fora_tarefa` como delegação, e o
`before_tool_callback` da avaliação respondendo a `delegar_tarefa` e `perguntar_delegacao` sem a API
do chat.

### CA3

**Marca:** documento

**Cenário:** Quem revisa encontra nesta pasta o registro da avaliação completa, com a taxa de
aprovação (meta ≥ 98%) e o custo por caso.

### CA4

**Marca:** documento

**Cenário:** Quem revisa encontra nesta pasta a medição do p95 do Pedido de delegação completo (meta
≤ 5 s), com o método, as amostras e o modelo.

### CA5

**Marca:** teste no Playwright

**Cenário:** A aba Tarefas, com Tarefas abertas e concluídas e uma em destaque, e a aba Todas com
Notificações de Tarefa, não têm violações do axe nos temas claro e escuro. A validação visual em
1440 × 900, contra os frames da seção "Tarefas (F12)" do Figma, fica registrada nesta pasta.

**Teste previsto:** Playwright, `e2e/acessibilidade/tarefas-sem-violacoes.spec.ts`, "a aba Tarefas
sem violações nos dois temas" e "a aba Todas com Notificações de Tarefa sem violações nos dois
temas"; registro `validacao-visual.md`.

### CA6

**Marca:** documento

**Cenário:** Quem revisa encontra nesta pasta o roteiro manual do Lighthouse, feito por uma pessoa,
com a nota de Acessibilidade da aba Tarefas nos dois temas.

## Contrato

O contrato não muda.

## Verificação do contrato

Nada a verificar.

## Decisões

- **Como conferir a delegação no `adk eval` (CA1).** O MCP `adk-docs`, única fonte permitida para o
  ADK, não conectou nesta sessão. A decisão provisória, a confirmar com ele antes de a avaliação
  rodar, usa o que o projeto já faz: os casos esperam a trajetória IN_ORDER pelo nome da
  ferramenta e pelos argumentos de valor fechado (`responsavel`, `falta`, `candidatos`); o `titulo`,
  texto livre, fica fora dos argumentos esperados e é conferido por rubrica do caso, sobre a
  confirmação que a ferramenta devolve. Se o `adk eval` comparar todos os argumentos, a saída é uma
  métrica própria, decidida na consulta.
- Na avaliação, o `before_tool_callback` responde a `delegar_tarefa` e a `perguntar_delegacao` como
  a produção, sem a API do chat: confere o Responsável contra as Menções e quem pediu, monta a
  pergunta e os rótulos pelo mesmo código, e marca o Pedido como respondido.
- A avaliação (CA3) e a medição (CA4) dependem do modelo real. Enquanto a chave do Gemini responder
  402, os dois registros ficam como pendência na tarefa, com o motivo.
- O roteiro do Lighthouse (CA6) é feito por uma pessoa; esta tarefa deixa o roteiro escrito e a nota
  em aberto.

## Arquivos e interfaces

- `apps/agents/app/eval_fixtures.py`: os stubs de `delegar_tarefa` e `perguntar_delegacao`.
- `apps/agents/tests/eval/assistente/assistente.evalset.json`: os casos de delegação e o
  `fora_tarefa` refeito.
- `apps/web/e2e/acessibilidade/tarefas-sem-violacoes.spec.ts`.
- Registros nesta pasta: `validacao-visual.md` (e capturas), `roteiro-lighthouse.md`, e, quando o
  modelo voltar, `avaliacao.md` e `medicao-p95.md`.

## Testes existentes que mudam

- O caso `fora_tarefa` do evalset passa a esperar a delegação.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum.
