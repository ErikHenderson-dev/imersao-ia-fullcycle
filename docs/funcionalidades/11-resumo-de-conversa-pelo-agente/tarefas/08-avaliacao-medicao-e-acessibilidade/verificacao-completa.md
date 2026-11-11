# Verificação completa da F11

2026-11-11 · rodada uma vez, no fim da F11, nos três projetos (seção "Verificação completa" do
`AGENTS.md` de cada um), depois das tarefas 01 a 08.

| Projeto | Passo | Resultado |
| --- | --- | --- |
| API do chat | `pnpm lint`, `tsc --noEmit`, `pnpm build` | passam |
| API do chat | `pnpm test` (unidade) | 85 de 85 |
| API do chat | `pnpm test:int` | 73 de 73, depois da correção 1 |
| API do chat | `pnpm test:e2e` | 461 de 461, depois da correção 2 |
| Serviço de agentes | lint, `pytest tests/unit` | passam (55 de 55) |
| Serviço de agentes | `pytest tests/integration` | 40 de 50: os 10 que chamam o modelo falham com `402 RESOURCE_EXHAUSTED` (créditos pré-pagos da API do Gemini esgotados); nenhum falha por outro motivo |
| Web | `pnpm lint`, `tsc --noEmit`, `pnpm test` (258 de 258), `pnpm build` | passam |
| Web | `npm run test:e2e` (suíte inteira) | 275 de 278; os 3 que falharam passam sozinhos (11 de 11): `atividade/abrir-na-mensagem` (2) e `perfil/presenca` (1), instáveis sob a suíte inteira |

**Correções que a verificação trouxe**

1. O módulo de Pessoas não registrava a entidade `Bot`, autor possível da Mensagem desde a
   F11-T01: um módulo que importa só ele não montava os metadados da relação, e o teste de
   transação entre módulos estourava o tempo no `beforeAll`.
2. `test/realtime-bot.e2e-spec.ts` contava também o evento atrasado da Mensagem do Pedido, que sob
   carga chega ao socket já conectado: passou a contar só os eventos do bot.

**O que fica de fora até os créditos voltarem:** a integração do Serviço de agentes com o modelo
real, a avaliação completa (CA1) e a medição do p95 e do custo (CA2). O teste do Playwright com o
modelo real passou porque aceita qualquer Mensagem do Agente, inclusive o "não consegui".
