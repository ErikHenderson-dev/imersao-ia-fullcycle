<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## Comandos

Todos rodam no contêiner `web`, a partir da raiz do repositório:

```bash
docker compose -f compose.yaml exec web <comando>
```

| Comando | O que faz |
| --- | --- |
| `pnpm dev --hostname 0.0.0.0` | Sobe o servidor de desenvolvimento (`http://localhost:3000`) |
| `pnpm lint` | ESLint com as regras do `eslint-config-next` |
| `pnpm exec tsc --noEmit` | Checagem de tipos |
| `pnpm test` | Testes de unidade das funções puras, com o Vitest (`src/**/*.test.ts`, em Node) |
| `pnpm build` | Compila a aplicação para produção |

Os testes de ponta a ponta rodam no contêiner `e2e` (`AGENTS.md` da raiz, "Subir e derrubar"), com a web, a API do chat e o Serviço de agentes de pé:

```bash
docker compose -f compose.yaml exec e2e <comando>
```

| Comando | O que faz |
| --- | --- |
| `npm run test:e2e` | Suíte do Playwright (`e2e/*.spec.ts`), só no Chromium e em modo headless |
| `npx playwright cli <comando>` | O `playwright-cli` do pacote instalado, sem instalação global |

A imagem do `e2e` tem npm, e não pnpm: os dois comandos só chamam o que o `pnpm install` do contêiner `web` instalou. A versão da imagem no `compose.yaml` é a mesma, exata, do `@playwright/test` no `package.json`; uma muda junto com a outra.

**Como escrever e corrigir os testes:** pela skill `playwright-cli`, no fluxo planejar, gerar e corrigir (`references/test-generation.md`), sempre no contêiner `e2e`. O teste-semente é `e2e/seed.spec.ts`.

## Verificação completa

1. `pnpm lint`
2. `pnpm exec tsc --noEmit`
3. `pnpm test`
4. `pnpm build`
5. `npm run test:e2e`, no contêiner `e2e`, com a web, a API do chat e o Serviço de agentes de pé

## Server Components

Todo componente nasce como Server Component. O `"use client"` precisa de um motivo: estado ou efeito, manipulador de evento, API do navegador ou hook que só existe no cliente. Buscar dados, ler cookies, formatar valores e montar layout não são motivo.

## Estrutura de pastas

O código fica em `src/`.

```
src/
  app/          Server Components, páginas, layouts e rotas da aplicação; o CSS global fica em `globals.css`.
    queries/    Arquivos de consultas (queries) da aplicação.
    actions/    Arquivos de ações do servidor (Server Actions) da aplicação.
    components/ Componentes reutilizáveis da aplicação.
    hooks/      Hooks personalizados da aplicação.
    utils/      Funções utilitárias da aplicação.
    services/   Arquivos de serviços da aplicação.
public/         Arquivos estáticos, como imagens e fontes (fora de `src/`).
```

## API Externas

A comunicação com APIs será feita através do `fetch`, mas, não deve ser feita diretamente nos componentes ou Server Actions. Em vez disto, crie serviços http dedicados na pasta `app/services/` e utilize-os nos componentes ou Server Actions.




