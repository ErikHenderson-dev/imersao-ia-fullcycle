# AGENTS.md

## Documentos

Em `docs/` estão os documentos que definem o produto, a arquitetura e os detalhes de implementação. Abaixo estão os principais do projeto:

1. `docs/product-brief.md`: o quê e para quem. Escopo do MVP, o que fica fora, planos e métricas.
2. `docs/hld.md`: High-level design, documento de arquitetura de alto nível. Aqui ficam as decisões de arquitetura, os fluxos principais e a visão geral do sistema.
3. `docs/lld.md`: Low-level design, documento de arquitetura de baixo nível. Aqui ficam os detalhes de implementação.
4. `docs/design-system.md`: linguagem visual da interface. Aqui ficam os tokens de cor, tipografia, espaçamento, raio e sombra, os estados de interação, os componentes, o comportamento responsivo e o fluxo de trabalho com o Figma.
5. `docs/roadmap.md`: as funcionalidades a desenvolver, as dependências entre elas e o status de cada uma.
6. `GLOSSARY.md`, na raiz: o vocabulário do domínio do produto. Use esses termos nos documentos e no planejamento.

Cada projeto tem o próprio `AGENTS.md`, com os comandos, as particularidades da stack e as práticas de código dele:

- `apps/chat-api/AGENTS.md`: API em NestJS.
- `apps/web/AGENTS.md`: frontend em Next.js.
- `apps/agents/AGENTS.md`: Serviço de agentes em Python com o Google ADK.

**Onde cada informação mora**

- **O que o sistema faz** fica em `docs/`: escopo, arquitetura, esquema, contrato, regras de negócio e configuração.
- **Nunca nos dois.** Uma informação tem um dono só, e o outro arquivo aponta para ele pelo nome do documento e da seção, sem repetir o conteúdo.
- **HLD e LLD mudam pela skill deles.** Quando uma tarefa muda algo que o `docs/hld.md` ou o `docs/lld.md` registra, carregue a skill `hld` ou `lld` e use o modo atualizar antes de editar o arquivo.
- **Informações que deveriam estar nos arquivos de memória** como AGENTS.md e rules, não devem ser repetidas nos documentos de arquitetura. Faça ponteiros destes arquivos para os arquivos de memória correspondentes.

## Execução no Docker

Tudo roda dentro dos contêineres do Docker Compose: instalação de dependências, servidor de desenvolvimento, testes, lint, compilação do TypeScript e qualquer outro comando do projeto. **Nunca rode `pnpm`, `node`, `npx`, `uv` ou `python` direto na máquina.**

O ambiente de desenvolvimento usa o `compose.yaml`, na raiz, com seis serviços e um sétimo, `e2e`, que só sobe pelo `profile`:

| Serviço | O que é | Endereço na máquina | Endereço entre contêineres |
| --- | --- | --- | --- |
| `web` | Frontend em Next.js | `http://localhost:3000` | `http://web:3000` |
| `chat-api` | API em NestJS, REST e WebSocket | `http://localhost:3001` | `http://chat-api:3000` |
| `agents` | Serviço de agentes em Python com o Google ADK | `http://localhost:3002` | `http://agents:8000` |
| `postgres` | PostgreSQL, com os bancos `chat`, `agents` e `business` | `localhost:5432` | `postgres:5432` |
| `s3` | Emulador do S3 (`seaweedfs`) | `http://localhost:8333` | `http://s3:8333` |
| `redis` | Redis, com os eventos por Pessoa da reconexão do WebSocket | `localhost:6379` | `redis:6379` |
| `e2e` | Playwright: testes de ponta a ponta do `web` e `playwright-cli` | — | — |

Os contêineres `web`, `chat-api` e `agents` instalam as dependências ao subir e depois ficam parados, sem iniciar a aplicação. Os comandos rodam neles com `docker compose -f compose.yaml exec <serviço> <comando>` e os de cada projeto estão no `AGENTS.md` dele.

### Subir e derrubar

```bash
docker compose -f compose.yaml up -d --build --wait
docker compose -f compose.yaml exec web pnpm dev --hostname 0.0.0.0
docker compose -f compose.yaml exec chat-api pnpm start:dev
docker compose -f compose.yaml exec agents uv run uvicorn app.fast_api_app:app --host 0.0.0.0 --port 8000
```

O `--wait` segura o primeiro comando só até o `postgres`, o `s3` e o `redis` ficarem prontos. A instalação das dependências continua dentro de `web`, `chat-api` e `agents` depois disso e, na primeira subida, leva alguns minutos: acompanhe com `docker compose -f compose.yaml logs -f <serviço>` antes de rodar os outros três. As migrações não rodam na subida. Os outros três ficam presos ao terminal, então rode cada um em segundo plano. O `--hostname 0.0.0.0` é necessário para que a web aceite conexões de fora do contêiner, e o `--host 0.0.0.0`, pelo mesmo motivo, no Serviço de agentes.

**Bot e administrador de desenvolvimento.** Depois das migrações, crie o bot do Agente `assistente`, que reserva o `@usuário` dele (`docs/funcionalidades/10-conexao-de-agentes/spec.md`, "Bots"), e dê o papel de administrador a uma Pessoa sua, para conectar Agentes pela tela:

```bash
docker compose -f compose.yaml exec chat-api pnpm accounts create-bot assistente Assistente
docker compose -f compose.yaml exec chat-api pnpm accounts set-admin <e-mail> on
```

**Testes de ponta a ponta.** O serviço `e2e` sobe à parte, com o ambiente acima já de pé (web, API do chat e banco). Ele não roda os testes sozinho: o processo dele só encaminha `localhost:3000` para a web e `localhost:3001` para a API do chat, para o navegador do teste usar os mesmos endereços que o da máquina e o cookie de sessão valer no WebSocket (`docs/lld.md`, "Ambiente de desenvolvimento"). Por isso, no `e2e`, a web é `localhost`, e não o nome do serviço, uma exceção à regra de "Rede entre serviços":

```bash
docker compose -f compose.yaml --profile e2e up -d e2e
```

Os comandos que rodam nele estão no `apps/web/AGENTS.md`. Para derrubá-lo junto com o resto, use `docker compose -f compose.yaml --profile e2e down`; sem o `--profile`, o `down` deixa o `e2e` de pé.

**Derrubar**

```bash
docker compose -f compose.yaml down
```

**Procedimentos raros**

**Recomeçar do zero.** Para apagar os dados e recriar o banco:

```bash
docker compose -f compose.yaml down -v
```

O `-v` apaga os volumes do banco e do armazenamento: na próxima subida, o script de `docker/postgres/init/` recria os bancos e os papéis, sem tabelas. Depois, suba o ambiente como em "Subir e derrubar".

**A instalação falhou.** O contêiner `web`, `chat-api` ou `agents` fica de pé mesmo quando o `pnpm install` ou o `uv sync` falha, então o erro só aparece no log:

```bash
docker compose -f compose.yaml logs chat-api
```

Depois do conserto, rode a instalação de novo no contêiner, com `docker compose -f compose.yaml exec chat-api pnpm install` (no `agents`, `uv sync --frozen --all-extras`).

### Rede entre serviços

Na conexão entre serviços (banco, storage), seja em variável de ambiente, arquivo de configuração ou código, **o host é sempre o nome do serviço do Compose**, como na coluna "Endereço entre contêineres" da tabela, e nunca `localhost` nem `127.0.0.1`: dentro de um contêiner, `localhost` é o próprio contêiner.

**Exceção:** quando o processo fala com algo que roda no mesmo contêiner, o endereço é `127.0.0.1`. É o caso do healthcheck de um serviço, que confere o próprio contêiner, e de um teste que abre um servidor temporário no contêiner onde roda.

## Design e Figma

O Figma é a ferramenta de design do projeto, acessada pelo servidor MCP do plugin `figma`.

**Arquivo do Figma:** <https://www.figma.com/design/plW17JDOoRHydUJIIi2u87/slack>

**Sempre que a tarefa envolver design ou interface, leia antes o `docs/design-system.md`**, seja para desenhar no Figma, seja para implementar uma tela ou um componente no código. Ele define os tokens, os componentes e o fluxo de trabalho com o Figma (sincronia, passos do Figma para o código, assets e validação visual), e as regras dele são obrigatórias.

## Planejamento

O planejamento e a documentação das funcionalidades ficam em arquivos markdown locais, que são o issue tracker do projeto. As skills que publicam num tracker gravam nesses arquivos, nos caminhos abaixo e sem rótulos de triagem.

A hierarquia é funcionalidade → tarefa, e cada funcionalidade tem dois documentos, o PRD e a spec:

- **Funcionalidade:** uma entrega demonstrável no produto, descrita só pelo que a pessoa consegue fazer, sem detalhes técnicos. Não é a Fase do `docs/product-brief.md`, que é uma fase do produto (MVP, operar como produto). O número da funcionalidade é global, sequencial e não muda depois de atribuído. Nos documentos de planejamento, "funcionalidade" é sempre este termo; para o sentido comum da palavra, use outra (recurso, comportamento).
- **PRD:** os requisitos de produto de uma funcionalidade (problema, fluxos, histórias, critérios de aceite, fora de escopo), feito pela skill `/prd`. Aponta para o `docs/product-brief.md`, que cobre o produto inteiro, em vez de repetir métricas e requisitos não funcionais.
- **Spec:** como a funcionalidade será construída (decisões de implementação e de teste). Segue o HLD, o LLD e as ADRs, apontando para eles.
- **Tarefa:** uma parte entregável de uma funcionalidade, a partir da spec. É nas tarefas que entra o trabalho técnico. Antes do código, cada tarefa ganha um **plano**, feito pela skill `/plan-task`, que é aprovado e commitado sozinho, no **commit de plano**. Depois disso o plano fica congelado, como registro do que foi aprovado: só o usuário o descongela, e uma decisão dele que se mostrar errada é corrigida na spec, no LLD ou numa tarefa nova. Fora da pasta da funcionalidade, a tarefa é identificada como `F<NN>-T<NN>`, como `F01-T02`.

**Estrutura de pastas**

```
docs/funcionalidades/<num-funcionalidade>-<titulo>/
  prd.md
  spec.md
  tarefas/
    <NN>-<titulo>/      ← uma pasta por tarefa
      tarefa.md         ← a tarefa
      plano.md          ← o plano da tarefa
      …                 ← registros da tarefa, se necessário
```

Os números têm dois dígitos e os títulos ficam em kebab-case sem acento (`01-entrar-e-sair`). As tarefas são numeradas a partir de `01` dentro de cada funcionalidade, na ordem de dependência.

A pasta da tarefa só recebe, além da tarefa e do plano, registros da própria tarefa, como o roteiro de um teste manual, o resultado de uma medição ou as capturas de uma validação visual. Eles ficam em Markdown ou imagem, com nome em kebab-case (`roteiro-manual.md`, `medicao-p95.md`). Código, fixtures de teste e configuração nunca vão para essa pasta: ficam no projeto a que pertencem. Só o `plano.md` congela no commit de plano; os outros registros são escritos durante a implementação e entram no PR da tarefa.

**Status**

- O status de cada funcionalidade (planejada → PRD pronto → spec pronta → em andamento → concluída) mora no roadmap, `docs/roadmap.md`, que também é dono da lista de funcionalidades.
- O status da tarefa (a fazer → em andamento → concluída) fica num campo Status no topo do `tarefa.md` dela. Ela passa a "em andamento" no commit de plano, e a "concluída" no PR que a entrega. Uma funcionalidade passa a "em andamento" no primeiro commit de plano de uma tarefa dela, e a "concluída" no PR da última tarefa dela.

**Verificação completa**

É a sequência de comandos que fecha uma tarefa, rodada uma vez antes de abrir o PR, para cada projeto que a tarefa tocou. Os comandos de cada projeto estão na seção "Verificação completa" do `AGENTS.md` dele. Uma tarefa que cria um comando que a verificação deve rodar (uma suíte de testes nova, por exemplo) o acrescenta a essa seção.

## Convenções de Git

- **Branch principal:** `main`. Nunca faça commit direto nela.
- **Branches de trabalho:** `feature/*`, `bugfix/*`, `hotfix/*` e `docs/*`, criadas a partir da `main` e integradas por pull request.
- **Commits:** mensagens curtas e descritivas, focadas no porquê da mudança.
- **Merge:** o merge é decisão do usuário. O agente só o faz quando o usuário autoriza expressamente aquele PR ou aquela tarefa. Sem autorização expressa, o agente não faz o merge, e uma negação do `gh pr merge` não se contorna por outro caminho.

## Consulta à documentação de bibliotecas

Quando precisar consultar a documentação de uma biblioteca, use o context7 para buscar informações atualizadas e precisas. A exceção é o Google ADK, na seção abaixo.

## Agentes e Google ADK

Sempre que a tarefa envolver agentes de IA ou o Google ADK, seja no código, no planejamento ou numa dúvida:

- **Carregue as skills** `google-agents-cli-workflow`, com o ciclo de desenvolvimento de agentes e as regras de código, e `google-agents-cli-adk-code`, com a API do ADK e as receitas de referência.
- **Consulte a documentação do ADK só pelo MCP `adk-docs`**: primeiro `list_doc_sources`, depois `fetch_docs` no `llms.txt` e nas páginas que ele lista. Nunca consulte de outra forma: nada de context7, busca na web, outro site ou memória do modelo.

As particularidades do projeto de agentes (o que dessas skills não se aplica, a avaliação e os comandos) estão no `apps/agents/AGENTS.md`.

## Agent Skill Usage

Sempre carregue as skills necessárias para a tarefa em questão.
Existem diversas skills de convenções e boas práticas que podem ser carregadas conforme a necessidade da tarefa, além das específicas para cada domínio ou tecnologia utilizada.

Quando uma skill diverge dos arquivos de memory ou rules, o que está no AGENTS.md ou rules prevalece.
