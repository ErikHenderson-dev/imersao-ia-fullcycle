## Arquitetura

O projeto segue uma arquitetura em camadas, com separação clara entre a interface de usuário (HTTP), a lógica de negócio (services) e a infraestrutura (repositories, banco de dados, armazenamento de arquivos etc.).

## Design

O projeto segue os princípios de SOLID:

- **S**: Single Responsibility Principle - um módulo (conceito de unidade de código, como uma classe ou um service) deve ser responsável por um, e apenas um, ator.
- **O**: Open/Closed Principle (Princípio Aberto/Fechado) - módulos devem estar abertos para extensão, mas fechados para modificação.
- **L**: Liskov Substitution Principle (Princípio da Substituição de Liskov) - subclasses devem poder substituir suas classes base sem alterar o comportamento esperado.
- **I**: Interface Segregation Principle (Princípio da Segregação de Interfaces) - interfaces específicas são melhores do que uma interface genérica e inchada.
- **D**: Dependency Inversion Principle (Princípio da Inversão de Dependência) - módulos de alto nível não devem depender de módulos de baixo nível; ambos devem depender de abstrações.

Os serviços do projeto seguem os princípios do Service Layer, do Martin Fowler, mantendo a lógica de negócio isolada da infraestrutura e da interface de usuário.

## Comandos

Todos rodam no contêiner `chat-api`, a partir da raiz do repositório:

```bash
docker compose -f compose.yaml exec chat-api <comando>
```

| Comando | O que faz |
| --- | --- |
| `pnpm start:dev` | Sobe a API em modo watch (`http://localhost:3001` na máquina) |
| `pnpm test` | Suíte de unidade (`*.spec.ts`) |
| `pnpm test:int` | Suíte de integração (`*.int-spec.ts`) |
| `pnpm test:e2e` | Suíte de ponta a ponta (`test/*.e2e-spec.ts`) |
| `pnpm test:watch` | Roda os testes de unidade em modo watch |
| `pnpm test:cov` | Roda os testes de unidade e gera relatório de cobertura |
| `pnpm lint` | ESLint com as regras do `typescript-eslint` que usam tipos e o Prettier como regra |
| `pnpm format` | Prettier em `src/` e `test/` |
| `pnpm exec tsc --noEmit` | Checagem de tipos |
| `pnpm build` | Compila para `dist/` |
| `pnpm migration:generate migrations/<Nome>` | Gera uma migração a partir da diferença entre as entidades e o Banco do chat |
| `pnpm migration:run` | Roda as migrações pendentes no Banco do chat |
| `pnpm migration:revert` | Reverte a última migração rodada |
| `pnpm accounts create <e-mail> "<nome>" [--username <u>] [--title "<cargo>"] [--phone "<tel>"]` | Comando de contas: cria a conta de uma Pessoa, já Membro de todos os Canais públicos. A senha é lida do terminal, sem eco, e nunca de argumento nem de variável. Sem `--username`, o @usuário vem do e-mail (spec da F05, "Pessoas") |
| `pnpm accounts update-profile <e-mail> [--title "<cargo>"] [--phone "<tel>"]` | Troca o cargo e o telefone; `""` apaga. O @usuário não muda |
| `pnpm accounts reset-password <e-mail>` | Troca a senha (lida do terminal) e revoga todas as Sessões da Pessoa |
| `pnpm accounts revoke-sessions <e-mail>` | Apaga todas as Sessões da Pessoa |
| `pnpm accounts purge-expired-sessions` | Apaga as Sessões vencidas |
| `pnpm accounts set-admin <e-mail\|@usuário> on\|off` | Dá ou tira o papel de administrador; vale na próxima ação da Pessoa, sem sair e entrar (spec da F10, "Comando de contas") |
| `pnpm channels create <nome> ["<tópico>"]` | Comando de canais: cria um Canal público, com todas as Pessoas como Membros |
| `pnpm channels set-topic <nome> "<tópico>"` | Troca o Tópico do Canal; `""` apaga |
| `pnpm channels list` | Lista os Canais públicos, com o número de Membros e o Tópico |
| `pnpm channels remove-member <nome> <e-mail>` | Tira a Pessoa de um Canal privado (spec da F04, "Comando de canais") |

O comando de contas precisa do terminal para ler a senha: rode com `docker compose -f compose.yaml exec chat-api ...`, que abre um TTY. As operações estão nas specs da F01, da F05 e da F10, "Comando de contas". As do comando de canais estão nas specs da F02 e da F04, "Comando de canais".

O `pnpm lint` roda com `--fix`: corrige o que dá e aponta o resto. O `pnpm format` reescreve os arquivos com o Prettier.

## Verificação completa

1. `pnpm lint`
2. `pnpm exec tsc --noEmit`
3. `pnpm test`
4. `pnpm test:int`
5. `pnpm test:e2e`
6. `pnpm build`

## Testes

O arquivo de teste leva o nome do arquivo testado. O sufixo define o nível do teste e a suíte que o executa:

| Nível | Sufixo | Onde fica | O que exercita |
| --- | --- | --- | --- |
| Unidade | `.spec.ts` | Ao lado do código, em `src/` | Testes de unidade testam uma classe isolada |
| Integração | `.int-spec.ts` | Ao lado do código, em `src/` | Testes de integração exercitam uma peça com suas dependências reais |
| Ponta a ponta | `.e2e-spec.ts` | Em `test/` | A aplicação inteira por HTTP |

**Banco dos testes:** as suítes e2e e de integração rodam no banco `chat_test`, que o `globalSetup` apaga, cria de novo e migra a cada execução. Detalhes no `docs/lld.md`, "Ambiente de desenvolvimento".

**Onde cada regra é provada:** as regras de negócio são provadas pelos testes de ponta a ponta, pelas rotas, com banco real. O teste de unidade de um service é opcional, e vale quando a regra tem muitos casos que seriam lentos ou repetitivos pelas rotas. Funções puras têm teste de unidade. A spec da funcionalidade pode restringir isso, e ela prevalece.

## Aplicação HTTP

- **Filtro de erros e validação:** O filtro de erros e a validação de entrada são registrados no `AppModule` (`APP_FILTER` e `APP_PIPE`), e não no `main.ts`, para valerem também nos testes.

## A camada de serviços

Um service recebe e devolve dados simples e tipos do domínio. Ele tem de poder ser chamado de um controller, de um gateway de WebSocket ou de um teste unitário sem nenhuma adaptação.

Antes de adicionar um import num arquivo de service, confira em qual dos dois grupos ele cai:

**Pode importar** e usar no service:

- `Injectable`, `Inject` e `Logger` do `@nestjs/common`
- Entidades, tipos e erros de domínio do próprio módulo
- O repository e os outros services do próprio módulo
- Utilitários puros, sem entrada e saída

**Não pode importar** e usar no service:

- `HttpException` e as filhas (`NotFoundException`, `BadRequestException` etc.) e `HttpStatus`
- `Request` e `Response` do Express, e os decorators de rota (`@Req`, `@Body`, `@Headers`)
- Repository, tabelas ou tipos internos de outro módulo
- `process.env`, direto. A configuração chega pelo módulo de config, por injeção.

A mesma regra vale para o repository: ele não importa nada de HTTP.

### Transações

Onde a transação começa e como passa entre módulos é regra do LLD, seção "Transações". Na prática, com o `@nestjs-cls/transactional` registrado no `DatabaseModule`:

- O repositório de quem participa vem de `txHost.tx.getRepository(Entidade)`, com `TransactionHost<TransactionalAdapterTypeOrm>` injetado. Fora de uma transação, o `txHost.tx` usa o gerenciador comum. O exemplo é o `PeopleService`.
- Fora do HTTP (comandos, rotinas), quem chama os services envolve a execução com `ClsService.run`, como o `cli.ts` do comando de contas. No HTTP, o middleware do `ClsModule` abre o contexto.

### Erros

O service lança erro de domínio, e só o exception filter global conhece o HTTP.

## Configuração

Toda configuração entra no projeto por um módulo de config próprio, em `src/config/`, feito com `@nestjs/config`.

