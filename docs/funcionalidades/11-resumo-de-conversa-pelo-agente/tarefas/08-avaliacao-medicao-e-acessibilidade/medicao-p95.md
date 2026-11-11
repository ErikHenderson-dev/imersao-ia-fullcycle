# Medição do p95 e do custo do Pedido comum

2026-11-11 · F11-T08 · Critérios: brief, "Objetivos e métricas de sucesso" ("Tempo de resposta",
p95 ≤ 5 s; "Custo por pedido", ≤ US$ 0,01)

**Resultado: as duas metas do brief não são atingidas numa Conversa de 500 Mensagens.** p95 de
14,5 s (meta 5 s) e custo de US$ 0,022 a US$ 0,025 por Pedido (meta US$ 0,01). A medição também
mostrou um defeito: 11 dos 20 resumos saíram cortados pelo teto de tokens de saída (abaixo, "Resumos
cortados"). O desenho não mudou nesta tarefa; a decisão é do usuário.

## Método

- Script `apps/web/e2e/medicao/resumo-p95.medicao.ts`, fora da suíte, rodado no contêiner `e2e`
  com o ambiente de desenvolvimento de pé (web no `next dev`, API do chat e Serviço de agentes) e o
  modelo padrão (`AGENT_MODEL=gemini-3.8-flash`, raciocínio no nível baixo):

  ```bash
  docker compose -f compose.yaml exec e2e npx playwright test --config playwright.medicao.config.ts
  ```

- 20 amostras. Em cada uma, um Canal novo com a Ana e três Pessoas de teste (prefixo `e2e-`) e 500
  Mensagens de hoje, no fuso padrão, com textos variados de um time; a Ana envia
  "@assistente resume hoje" pela caixa de mensagem. Um Canal por amostra, porque o pedido de uma
  amostra entraria no Recorte da seguinte. "Hoje" com as 500 lidas é o pior caso de entrada do Pedido
  comum (o teto de Mensagens).
- O tempo vai da Mensagem do pedido entrar na lista de Mensagens da aba da Ana até a Mensagem do
  Agente entrar nela, marcados na própria página (`performance.now()` num `MutationObserver` da
  lista), para a espera do Playwright não entrar na amostra. Só o resumo vale como amostra: uma
  resposta sem o cabeçalho "Resumo" (a pergunta pelo Recorte, a recusa, o "não consegui") falha a
  medição. O script recusa rodar a menos de 30 min depois ou 10 min antes da meia-noite do fuso
  padrão.
- O script segura a trava dos Agentes, conecta o `assistente` e devolve o estado em que o achou. As
  Conversas de desenvolvimento do usuário não são lidas nem mudadas.
- O tempo do Serviço de agentes e os tokens de cada Pedido saem do registro `pedido_concluido` no log
  dele (`tempo_ms`, `tokens_entrada`, `tokens_saida`, este com o raciocínio), pelo id do Pedido que o
  script imprime.

## Preço do modelo padrão

Gemini 3.8 Flash, nível pago Standard, na página oficial de preços da API do Gemini
(<https://aistudio.google.com/docs/pricing>, para onde `https://ai.google.dev/gemini-api/docs/pricing`
redireciona), consultada em 2026-11-11:

| Item | Até 31/12/2026 | A partir de 01/01/2027 |
| --- | --- | --- |
| Entrada, por milhão de tokens | US$ 0,75 | US$ 1,50 |
| Saída, com o raciocínio, por milhão de tokens | US$ 3,75 | US$ 7,50 |
| Entrada em cache, por milhão de tokens | US$ 0,075 | US$ 0,15 |

Custo do Pedido = entrada × 0,75 / 10⁶ + saída × 3,75 / 10⁶, sem o desconto de cache (um teto). Com
o preço de 2027, o custo dobra.

## Amostras

Em 2026-11-11, entre 20:35 e 20:40 de São Paulo. "Ponta a ponta" é o tempo na tela; "Serviço" é o
`tempo_ms` do Pedido no Serviço de agentes. Todos os Pedidos terminaram com `desfecho=reply`.

| # | Ponta a ponta | Serviço | Entrada | Saída | Custo (US$) | Resumo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 10,95 s | 10,47 s | 28111 | 824 | 0,0242 | completo |
| 2 | 7,10 s | 6,63 s | 28096 | 405 | 0,0226 | completo |
| 3 | 12,09 s | 11,54 s | 28133 | 1107 | 0,0253 | cortado |
| 4 | 12,81 s | 12,34 s | 28115 | 1089 | 0,0252 | cortado |
| 5 | 10,21 s | 9,64 s | 28109 | 766 | 0,0240 | completo |
| 6 | 12,25 s | 11,76 s | 28115 | 1089 | 0,0252 | cortado |
| 7 | 11,46 s | 10,38 s | 28115 | 887 | 0,0244 | completo |
| 8 | 7,11 s | 6,58 s | 28106 | 363 | 0,0224 | completo |
| 9 | 12,23 s | 11,66 s | 28129 | 1103 | 0,0252 | só o cabeçalho |
| 10 | 14,51 s | 14,01 s | 28115 | 1089 | 0,0252 | cortado |
| 11 | 12,44 s | 11,94 s | 28117 | 1091 | 0,0252 | cortado |
| 12 | 6,92 s | 6,42 s | 28065 | 372 | 0,0224 | completo |
| 13 | 15,48 s | 14,78 s | 28101 | 988 | 0,0248 | completo |
| 14 | 12,16 s | 11,63 s | 28124 | 1098 | 0,0252 | cortado |
| 15 | 11,98 s | 11,40 s | 28113 | 1087 | 0,0252 | cortado |
| 16 | 11,63 s | 11,11 s | 28121 | 1095 | 0,0252 | cortado |
| 17 | 12,63 s | 12,12 s | 28118 | 1092 | 0,0252 | só o cabeçalho e um nome |
| 18 | 6,12 s | 5,62 s | 28115 | 331 | 0,0223 | completo |
| 19 | 6,53 s | 6,04 s | 28065 | 263 | 0,0220 | completo |
| 20 | 11,53 s | 10,99 s | 28146 | 1120 | 0,0253 | só o cabeçalho |

| Medida (posto mais próximo) | Ponta a ponta, 20 amostras | Só os 9 resumos completos |
| --- | --- | --- |
| p50 | 11,63 s | 7,11 s |
| p95 | **14,51 s** | 15,48 s |
| Mínimo / máximo | 6,12 s / 15,48 s | 6,12 s / 15,48 s |

Custo por Pedido: de US$ 0,0220 a US$ 0,0253, média US$ 0,0243.

## Causas

- **Tempo:** quase todo no modelo. O Serviço de agentes responde por 90% a 97% de cada amostra (o
  BFF, a API do chat, o disparo e a tela somam de 0,5 a 1,1 s, na ordem do que o ensaio sem o modelo
  mostrou). O Pedido faz duas chamadas ao modelo: a primeira escolhe o Recorte e chama
  `ler_mensagens`; a segunda lê as 500 Mensagens (cerca de 28 mil tokens de entrada) e gera o resumo
  com o raciocínio. O tempo cresce com a saída: até cerca de 400 tokens, de 6 a 7 s; perto do teto
  de 1024, de 11 a 15 s.
- **Custo:** a entrada das 500 Mensagens custa sozinha cerca de US$ 0,021 (28 mil tokens a
  US$ 0,75 por milhão), o dobro da meta, antes de qualquer saída. Os Pedidos com Recortes de poucas
  Mensagens ficam abaixo de US$ 0,006 ([avaliacao.md](avaliacao.md)).

## Resumos cortados

Em 11 das 20 amostras, a segunda chamada atingiu o `max_output_tokens` de 1024 (saída do Pedido entre
1087 e 1120 tokens, a primeira chamada mais 1024), e o resumo gravado terminou no meio de uma frase.
Em três, só o cabeçalho, ou o cabeçalho e um nome, chegou à Conversa. O raciocínio conta no teto, e
com 500 Mensagens variadas ele mais o texto passam de 1024 mesmo no nível baixo; a avaliação não
pegou isso porque o caso `teto` repete poucas frases e ficou em 833 tokens. O corte não é detectado:
o texto cortado é gravado como `reply`. Mudar o teto de tokens de saída (constante da spec, "Modelo de
IA"), o nível de raciocínio ou o tamanho da entrada é decisão do desenho e fica para o usuário.

## Ensaio do script, sem o modelo

Antes da medição, sem créditos na API do Gemini (`402 RESOURCE_EXHAUSTED`), o script rodou uma vez
para conferir a mecânica, numa versão que ainda aceitava qualquer resposta do Agente: os Pedidos
terminaram com o "não consegui" (`tempo_ms` de 359 a 389 ms), e o tempo de ponta a ponta até ele foi
p50 959 ms e p95 1970 ms, no `next dev`. É o custo do caminho sem o modelo.
