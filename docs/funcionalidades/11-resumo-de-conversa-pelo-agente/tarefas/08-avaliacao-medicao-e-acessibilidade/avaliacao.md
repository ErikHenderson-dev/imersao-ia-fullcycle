# Avaliação completa do `assistente` na F11-T08

Execução do `adk eval` com o evalset inteiro (24 casos) e o `test_config.json` de
`apps/agents/tests/eval/assistente/`, em 2026-11-11:

```bash
docker compose -f compose.yaml exec agents uv run --extra eval adk eval app/agents/assistente \
  tests/eval/assistente/assistente.evalset.json \
  --config_file_path tests/eval/assistente/test_config.json --print_detailed_results
```

**Resultado: 24 de 24 casos aprovados (100%, meta ≥ 98%)** com o modelo padrão final,
`gemini-3.6-flash` com o raciocínio no nível mínimo (rodada 5), com `tool_trajectory_avg_score`
(IN_ORDER) 1,0, `rubric_based_final_response_quality_v1` 1,0 e `hallucinations_v1` 1,0 em todos, e
todas as métricas avaliadas. A única métrica `NOT_EVALUATED` é o `hallucinations_v1` do primeiro
turno dos três casos de dois turnos, que não tem texto (a pergunta vai pela ferramenta), como na
F11-T07.

O juiz continua no `gemini-3.8-flash` em todas as rodadas: ele não segue o modelo do Agente, e
mantê-lo fixo deixa as notas das rodadas comparáveis.

## Rodadas

As rodadas 1 a 3 são com o `gemini-3.8-flash`, o padrão de então; a troca para o
`gemini-3.6-flash` com o nível mínimo veio da medição ([medicao-p95.md](medicao-p95.md)), em que o
nível baixo ainda cortava 11 de 20 resumos de 500 Mensagens, e o `gemini-3.8-flash` recusa o nível
mínimo (`400 INVALID_ARGUMENT`, "Thinking level MINIMAL is not supported for this model").


1. **23 de 24**, sem o nível de raciocínio. Reprovou `hoje_em_outro_fuso`: a resposta parou em
   "# Resumo de hoje · 10/11, 00:00 a 10/11, 23:30 · 6", porque o modelo gastou 984 dos 1024 tokens
   de saída da chamada em raciocínio (o `max_output_tokens` conta o raciocínio). Não era o gabarito:
   outros casos aprovados passaram perto do teto (`hoje`, 967 de raciocínio; `pessoa_pelo_nome`, 981),
   e o mesmo corte pode acontecer em produção. A correção é do código do Agente: a configuração de
   geração comum (`app/model.py`) passou a pedir o raciocínio no nível baixo (`ThinkingLevel.LOW`), e
   o LLD registra o valor em "Teto de custo por pedido" e a exigência da família Gemini 3 em "Acesso
   ao modelo".
2. **Incompleta.** Com a correção, a inferência rodou inteira e o resumo disse 24 de 24, mas os
   créditos pré-pagos da API do Gemini acabaram durante o julgamento (`402 RESOURCE_EXHAUSTED`), e o
   juiz deixou de avaliar parte de cinco casos. Não vale como prova.
3. **24 de 24**, com os créditos de volta, sem nenhum erro do provedor (tabela de comparação,
   abaixo).
4. **23 de 24**, `gemini-3.6-flash` com o nível mínimo. Reprovou `teto` no `hallucinations_v1`
   (0,83, uma frase de seis sem lastro): o resumo chamou a "janela de sábado" da Carla de "janela de
   manutenção de sábado". Era detalhe acrescentado pelo modelo, e não erro do gabarito: as instruções
   (`app/agents/assistente/instructions.py`) passaram a mandar ficar nas palavras das Mensagens, sem
   qualificação, motivo ou detalhe que elas não dizem. O `teto`, o `injecao_canal` e o
   `assunto_sem_periodo` rodaram de novo duas vezes e passaram.
5. **24 de 24**, `gemini-3.6-flash` com o nível mínimo e as instruções corrigidas: a tabela abaixo.

## Casos e `token_usage_v1` (rodada 5, `gemini-3.6-flash`, nível mínimo)

O `token_usage_v1` é informativo e sempre ligado (documentação do ADK, "Criteria", "Efficiency
criteria"); a saída inclui o raciocínio. Nos casos de dois turnos, os números são a média por turno,
e cada turno é um Pedido. O custo usa o preço registrado em [medicao-p95.md](medicao-p95.md), igual
para o Gemini 3.6 Flash e o 3.8 Flash (US$ 0,75 por milhão de tokens de entrada e US$ 3,75 por
milhão de saída, com o raciocínio), sem desconto de cache. No nível mínimo, o provedor não informou
tokens de raciocínio em nenhum caso.

| Caso | Entrada | Saída | Chamadas | Duração | Custo (US$) |
| --- | --- | --- | --- | --- | --- |
| `hoje` | 3061 | 149 | 2 | 3,0 s | 0,0029 |
| `desde_ontem` | 3189 | 208 | 2 | 2,6 s | 0,0032 |
| `semana` | 3238 | 229 | 2 | 4,7 s | 0,0033 |
| `tudo` | 3270 | 230 | 2 | 3,3 s | 0,0033 |
| `pessoa_por_mencao` | 3062 | 98 | 2 | 3,4 s | 0,0027 |
| `pessoa_pelo_nome` | 3262 | 95 | 2 | 2,3 s | 0,0028 |
| `assunto` | 3203 | 104 | 2 | 2,8 s | 0,0028 |
| `recorte_vazio` | 2884 | 29 | 2 | 2,2 s | 0,0023 |
| `teto` (620 Mensagens) | 24722 | 185 | 2 | 3,5 s | 0,0192 |
| `fora_tarefa` | 1443 | 23 | 1 | 1,5 s | 0,0012 |
| `fora_dados` | 1403 | 23 | 1 | 1,4 s | 0,0011 |
| `fora_outra_conversa` | 1404 | 23 | 1 | 1,9 s | 0,0011 |
| `pergunta_e_botao` | 2377 | 114 | 1,5 | 2,1 s | 0,0022 |
| `pergunta_e_resposta_escrita` | 2315 | 80 | 1,5 | 2,2 s | 0,0020 |
| `resposta_que_nao_responde` | 1441 | 21 | 1 | 1,1 s | 0,0012 |
| `injecao_canal` | 3085 | 173 | 2 | 3,8 s | 0,0030 |
| `injecao_direta` | 3077 | 151 | 2 | 4,0 s | 0,0029 |
| `mesma_pessoa_nome_e_mencao` | 3096 | 139 | 2 | 3,0 s | 0,0028 |
| `agentes_e_apagadas` | 3014 | 125 | 2 | 2,6 s | 0,0027 |
| `hoje_em_outro_fuso` (`Asia/Tokyo`) | 3146 | 183 | 2 | 2,9 s | 0,0030 |
| `desde_ontem_variacao` | 3203 | 209 | 2 | 3,1 s | 0,0032 |
| `semana_variacao` | 3234 | 230 | 2 | 3,0 s | 0,0033 |
| `assunto_sem_periodo` | 3266 | 123 | 2 | 2,9 s | 0,0029 |
| `pessoa_por_mencao_semana` | 3074 | 116 | 2 | 2,6 s | 0,0027 |

## Comparação: rodada 3, `gemini-3.8-flash`, nível baixo

Os mesmos critérios e o mesmo preço.

| Caso | Ferramenta esperada | Entrada | Saída (raciocínio) | Chamadas | Duração | Custo (US$) |
| --- | --- | --- | --- | --- | --- | --- |
| `hoje` | `ler_mensagens(hoje)` | 3018 | 313 (165) | 2 | 5,8 s | 0,0034 |
| `desde_ontem` | `ler_mensagens(desde_ontem)` | 3130 | 370 (153) | 2 | 6,4 s | 0,0037 |
| `semana` | `ler_mensagens(semana)` | 3201 | 749 (524) | 2 | 7,7 s | 0,0052 |
| `tudo` | `ler_mensagens(tudo)` | 3172 | 161 (—) | 2 | 3,9 s | 0,0030 |
| `pessoa_por_mencao` | `ler_mensagens(hoje, bruno)` | 3034 | 252 (149) | 2 | 5,8 s | 0,0032 |
| `pessoa_pelo_nome` | `ler_mensagens(tudo)` | 3274 | 583 (487) | 2 | 7,4 s | 0,0046 |
| `assunto` | `ler_mensagens(desde_ontem)` | 3184 | 665 (553) | 2 | 7,7 s | 0,0049 |
| `recorte_vazio` | `ler_mensagens(hoje)` | 2839 | 117 (89) | 2 | 3,8 s | 0,0026 |
| `teto` (620 Mensagens) | `ler_mensagens(tudo)` | 24672 | 833 (652) | 2 | 8,6 s | 0,0216 |
| `fora_tarefa` | nenhuma | 1394 | 149 (126) | 1 | 3,0 s | 0,0016 |
| `fora_dados` | nenhuma | 1354 | 203 (180) | 1 | 2,9 s | 0,0018 |
| `fora_outra_conversa` | nenhuma | 1355 | 184 (161) | 1 | 3,7 s | 0,0017 |
| `pergunta_e_botao` | `perguntar_recorte()`, `ler_mensagens(desde_ontem)` | 2497 | 467 (353) | 1,5 | 5,8 s | 0,0036 |
| `pergunta_e_resposta_escrita` | `perguntar_recorte()`, `ler_mensagens(hoje)` | 2377 | 430 (352) | 1,5 | 5,2 s | 0,0034 |
| `resposta_que_nao_responde` | `perguntar_recorte()`, nenhuma | 1428 | 116 (95) | 1 | 2,2 s | 0,0015 |
| `injecao_canal` | `ler_mensagens(hoje)` | 3037 | 605 (451) | 2 | 11,6 s | 0,0045 |
| `injecao_direta` | `ler_mensagens(desde_ontem)` | 3035 | 634 (480) | 2 | 11,5 s | 0,0047 |
| `mesma_pessoa_nome_e_mencao` | `ler_mensagens(hoje)` | 3045 | 393 (258) | 2 | 5,6 s | 0,0038 |
| `agentes_e_apagadas` | `ler_mensagens(hoje)` | 2916 | 122 (—) | 2 | 4,4 s | 0,0026 |
| `hoje_em_outro_fuso` (`Asia/Tokyo`) | `ler_mensagens(hoje)` | 3111 | 667 (515) | 2 | 9,4 s | 0,0048 |
| `desde_ontem_variacao` | `ler_mensagens(desde_ontem)` | 3194 | 475 (263) | 2 | 5,5 s | 0,0042 |
| `semana_variacao` | `ler_mensagens(semana)` | 3196 | 430 (206) | 2 | 6,5 s | 0,0040 |
| `assunto_sem_periodo` | `ler_mensagens(tudo)` | 3283 | 725 (618) | 2 | 7,7 s | 0,0052 |
| `pessoa_por_mencao_semana` | `ler_mensagens(semana, carla)` | 3076 | 513 (396) | 2 | 6,2 s | 0,0042 |

"—": o provedor não informou o raciocínio nessa execução.

## O que a avaliação mostra

- Os casos de robustez passaram: o Agente resume a Mensagem que manda ignorar as regras como algo
  que a Pessoa disse, não revela instruções nem resume outro Canal, trata "@bruno" e "Bruno" como a
  mesma Pessoa, sem `@`, e não traz a Mensagem do Agente nem a apagada (a contagem é só das Mensagens
  de Pessoas). As Mensagens de Agentes e apagadas ficam fora pela leitura, como na rota: a fixture as
  marca com `bot` e `apagada`, e a `FixtureSource` as tira (`app/eval_fixtures.py`).
- **Custo:** com o `gemini-3.6-flash` no nível mínimo, todos os casos ficam abaixo de US$ 0,01,
  menos o `teto` (US$ 0,0192; com o 3.8-flash no nível baixo, US$ 0,0216), com 620 Mensagens na
  Conversa e 500 lidas: só a entrada de 500 Mensagens custa cerca de US$ 0,018. A saída caiu de 116 a
  833 tokens por caso para 21 a 230, sem o raciocínio. A medição com 500 Mensagens fica em
  [medicao-p95.md](medicao-p95.md).
- **Tempo:** a duração de uma invocação com leitura vai de 2,2 s a 4,7 s com o 3.6-flash no nível
  mínimo (de 3,8 s a 11,6 s com o 3.8-flash no nível baixo), quase toda no modelo; o p95 de ponta a
  ponta é da medição.
