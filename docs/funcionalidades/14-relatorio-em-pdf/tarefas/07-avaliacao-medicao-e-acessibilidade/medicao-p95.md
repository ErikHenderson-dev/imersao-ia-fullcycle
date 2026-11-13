# Medição do p95 do Relatório em PDF

2026-11-12 · F14-T07, CA4 · Metas: aviso com p95 ≤ 5 s e entrega com p95 ≤ 60 s (PRD da F14,
seção 3; brief, "Tempo de resposta")

**Resultado: aviso com p95 de 1,90 s e entrega com p95 de 2,55 s, dentro das metas**, com o
`gemini-3.6-flash` no raciocínio mínimo e o Worker no contêiner `worker`, 10 amostras, em
2026-11-12.

## Como medir

Com a web, a API do chat, o Serviço de agentes e o Worker de pé, o Banco de negócio carregado e o
contêiner `e2e` no ar:

```bash
docker compose -f compose.yaml exec e2e npx playwright test -c playwright.medicao.config.ts e2e/medicao/relatorio-p95.medicao.ts
```

A medição (`e2e/medicao/relatorio-p95.medicao.ts`) faz 10 Pedidos de Relatório completos, de
períodos diferentes, cada um num Canal novo, e mede da Mensagem enviada até o Aviso de início e até
a entrega aparecerem para quem pediu; imprime uma linha JSON por amostra e o resumo no fim.

| Marco | Amostras | p50 | p95 | Mínimo | Máximo |
| --- | --- | --- | --- | --- | --- |
| Aviso de início | 10 | 1,76 s | 1,90 s | 1,52 s | 1,90 s |
| Entrega com o PDF | 10 | 1,99 s | 2,55 s | 1,94 s | 2,55 s |

A entrega chega cerca de 0,2 s depois do aviso: o Worker consulta os dois períodos, monta o PDF,
confere o lastro e grava no S3 em bem menos de 1 s, com os dados fixos.

Observação: na execução registrada, as 10 amostras e o resumo foram impressos, e o Playwright acusou
falha só no fechamento do contexto, por um arquivo de trace que sumiu de `test-results/` (uma
captura de tela rodou ao mesmo tempo no mesmo contêiner e limpou a pasta). A medição em si terminou.
