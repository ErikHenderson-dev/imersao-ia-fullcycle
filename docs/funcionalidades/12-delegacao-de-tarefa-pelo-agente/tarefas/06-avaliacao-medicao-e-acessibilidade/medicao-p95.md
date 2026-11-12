# Medição do p95 da delegação de Tarefa

2026-11-12 · F12-T06 · Critério: brief, "Tempo de resposta" (p95 ≤ 5 s)

**Resultado: p95 de 1,86 s e p50 de 1,51 s, com o `gemini-3.6-flash` no raciocínio mínimo. A meta é
atingida.**

## Método

`apps/web/e2e/medicao/delegacao-p95.medicao.ts`, fora da suíte, no contêiner `e2e`:

```bash
npx playwright test --config playwright.medicao.config.ts e2e/medicao/delegacao-p95.medicao.ts
```

Vinte amostras, cada uma num Canal novo com a Ana e o Bruno. A Ana envia "@assistente delega pra
@bruno <tarefa>", e o tempo vai da Mensagem dela entrar na lista até a confirmação do Agente entrar,
marcados na própria página, como na medição da F11. Só vale a amostra cuja resposta é a confirmação
("Tarefa delegada a").

## Amostras (ms)

1446, 1139, 1319, 1534, 1665, 1446, 1662, 1199, 1859, 1652, 1255, 1746, 1509, 1217, 1868, 1498, 1684,
1737, 1285, 1783

Mínimo 1139, p50 1509, p95 1859, máximo 1868.
