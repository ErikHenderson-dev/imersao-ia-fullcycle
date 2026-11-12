# Medição do p95 da consulta

2026-11-12 · F13-T07, CA4 · Meta: p95 ≤ 5 s (brief, "Tempo de resposta")

**Resultado: não rodou.** A medição chama o modelo padrão, e a chave do Gemini responde
`402 RESOURCE_EXHAUSTED` (créditos pré-pagos esgotados).

## Como medir

Com a web, a API do chat e o Serviço de agentes de pé, o Banco de negócio carregado e o contêiner
`e2e` no ar:

```bash
docker compose -f compose.yaml exec e2e npx playwright test -c playwright.medicao.config.ts e2e/medicao/consulta-p95.medicao.ts
```

A medição (`e2e/medicao/consulta-p95.medicao.ts`) faz 20 perguntas completas de Métricas diferentes,
cada uma num Canal novo, e mede da Mensagem enviada até a resposta com "Considerado:" aparecer para
quem pediu; imprime uma linha JSON por amostra e o p50 e o p95 no fim.

| Amostras | p50 | p95 | Máximo | Modelo |
| --- | --- | --- | --- | --- |
| a medir | | | | |
