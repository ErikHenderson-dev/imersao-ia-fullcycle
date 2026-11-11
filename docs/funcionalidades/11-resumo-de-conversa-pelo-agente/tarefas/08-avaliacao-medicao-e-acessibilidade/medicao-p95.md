# Medição do p95 e do custo do Pedido comum

2026-11-11 · F11-T08 · Critérios: brief, "Objetivos e métricas de sucesso" ("Tempo de resposta",
p95 ≤ 5 s; "Custo por pedido", ≤ US$ 0,01)

**Situação: não executada.** Os créditos pré-pagos da API do Gemini acabaram durante a avaliação
(`402 RESOURCE_EXHAUSTED`, "Your prepayment credits are depleted"), e o Serviço de agentes não
consegue chamar o modelo padrão. O script e o método estão prontos; falta rodar com créditos e
preencher "Resultado". O CA2 fica desmarcado até lá.

## Método

- Script `apps/web/e2e/medicao/resumo-p95.medicao.ts`, fora da suíte, rodado no contêiner `e2e`
  com o ambiente de desenvolvimento de pé (web no `next dev`, API do chat e Serviço de agentes) e o
  modelo padrão (`AGENT_MODEL=gemini-3.8-flash`):

  ```bash
  docker compose -f compose.yaml exec e2e npx playwright test --config playwright.medicao.config.ts
  ```

- 20 amostras. Em cada uma, um Canal novo com a Ana e três Pessoas de teste (prefixo `e2e-`) e 500
  Mensagens de hoje, no fuso padrão, com textos variados de um time; a Ana envia
  "@assistente resume hoje" pela caixa de mensagem. O tempo vai do Enter até a Mensagem do Agente
  entrar na lista da aba dela, marcados na própria página (`performance.now()` no Enter e num
  `MutationObserver` da lista), para a espera do Playwright não entrar na amostra. Só o resumo vale
  como amostra: uma resposta sem o cabeçalho "Resumo" (a pergunta pelo Recorte, a recusa, o "não
  consegui") falha a medição. O script recusa rodar a menos de 30 min depois ou 5 min antes da
  meia-noite do fuso padrão. Um Canal por amostra, porque o pedido de uma amostra entraria no Recorte da
  seguinte. "Hoje" com as 500 lidas é o pior caso de entrada do Pedido comum (o teto de Mensagens).
- O script segura a trava dos Agentes, conecta o `assistente` e devolve o estado em que o achou. As
  Conversas de desenvolvimento do usuário não são lidas nem mudadas.
- O script imprime uma linha JSON por amostra, com o id do Pedido e o tempo, e o p50 e o p95 pelo
  posto mais próximo (a 19ª de 20 amostras em ordem). O tempo do Serviço de agentes e os tokens de
  cada Pedido saem do registro `pedido_concluido` no log dele (`tempo_ms`, `tokens_entrada`,
  `tokens_saida`, este com o raciocínio):

  ```bash
  docker compose -f compose.yaml exec agents grep pedido_concluido /tmp/agents.log
  ```

## Preço do modelo padrão

Gemini 3.8 Flash, nível pago Standard, na página oficial de preços da API do Gemini
(<https://aistudio.google.com/docs/pricing>, para onde `https://ai.google.dev/gemini-api/docs/pricing`
redireciona), consultada em 2026-11-11:

| Item | Até 31/12/2026 | A partir de 01/01/2027 |
| --- | --- | --- |
| Entrada, por milhão de tokens | US$ 0,75 | US$ 1,50 |
| Saída, com o raciocínio, por milhão de tokens | US$ 3,75 | US$ 7,50 |
| Entrada em cache, por milhão de tokens | US$ 0,075 | US$ 0,15 |

Custo do Pedido = entrada × 0,75 / 10⁶ + saída × 3,75 / 10⁶, sem o desconto de cache (um teto).

## Resultado

A preencher: as 20 amostras, o p50, o p95 e o máximo de ponta a ponta, o `tempo_ms` do Serviço de
agentes e os tokens e o custo de cada Pedido.

## Ensaio do script, sem o modelo

Em 2026-11-11, já sem créditos, o script rodou inteiro uma vez para conferir a mecânica, antes da
exigência do "Resumo", que depois o faz parar na primeira amostra sem o modelo: os 20
Canais de 500 Mensagens, as marcas na página e a volta do `assistente` ao estado em que estava. A
chamada ao modelo falhou com o `402` em todos os Pedidos, e o Serviço de agentes gravou o "não
consegui" (`desfecho=failed`, `tempo_ms` de 359 a 389 ms no log). O tempo de ponta a ponta até essa
resposta foi p50 959 ms, p95 1970 ms e máximo 2059 ms. **Não é a medição do CA2:** mostra só o custo
do caminho sem o modelo (BFF, API do chat, disparo, uma chamada recusada e a gravação), no `next dev`.

## O que a avaliação já indica

Sem substituir a medição, o caso `teto` da avaliação ([avaliacao.md](avaliacao.md), rodada 2) lê
500 Mensagens (de 620) com o mesmo modelo e o raciocínio no nível baixo: 24.668 tokens de entrada e
951 de saída (769 de raciocínio), em 2 chamadas ao modelo e 10,1 s de invocação, a US$ 0,0221. Se a
medição confirmar esses números, o Pedido com 500 Mensagens passa das duas metas do brief: o tempo é
quase todo do modelo, e o custo, da entrada (cerca de US$ 0,018 só para as 500 Mensagens). Os
Pedidos com Recortes de poucas Mensagens ficam entre 4,5 s e 8 s e abaixo de US$ 0,006. Nenhum
ajuste de desenho entra nesta tarefa; a decisão sobre as metas é do usuário.
