# Plano da F05-T03: Hora local no Perfil

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa com Sessão, quando ela grava `America/Manaus` pelo
`PUT /v1/people/me/time-zone`, então recebe 204 e o Perfil dela passa a ter esse fuso; gravar o
mesmo fuso de novo também responde 204; `Lua/Crateras`, um texto vazio ou a falta do campo recebem
400 `validation_failed`; sem Sessão, 401.

**Teste previsto:** e2e da API, `test/people-time-zone.e2e-spec.ts`, "responde 204 e grava o
fuso", "responde 204 ao gravar o mesmo fuso", "responde 400 validation_failed para %s" (`it.each`)
e "responde 401 sem Sessão".

### CA2

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa com fuso gravado, quando ela entra e quando a Sessão é verificada, então
a Pessoa da resposta traz `time_zone`; sem fuso, `null`.

**Teste previsto:** e2e da API, `test/sessions.e2e-spec.ts`, os mesmos casos da F05-T01, com
`time_zone` no `toEqual`, e `test/people-time-zone.e2e-spec.ts`, "a Sessão devolve o fuso gravado".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dado um navegador em `Asia/Tokyo` e uma Pessoa sem fuso, quando ela abre o chat, então
o fuso dela fica `Asia/Tokyo` no banco; quando a gravação é recusada, nada aparece na tela e a
página não pede de novo.

**Teste previsto:** Playwright, `e2e/perfil/hora-local.spec.ts`, "grava o fuso do navegador ao
abrir o chat" e "a recusa ao gravar o fuso não aparece nem repete" (a Server Action respondida
com falha pelo `routeServerAction`).

### CA4

**Marca:** teste de unidade

**Cenário:** Dado um instante e um fuso, quando a função monta a hora local, então devolve "HH:MM no
horário local" naquele fuso, independentemente do fuso do processo; e dá o tempo até a virada do
próximo minuto.

**Teste previsto:** Vitest, `src/app/utils/local-time.test.ts`, "monta a hora em outro fuso" e
"conta o tempo até a virada do minuto".

### CA5

**Marca:** teste HTTP

**Cenário:** O mesmo do CA1 e do CA2, mais o Vitest do CA4.

**Teste previsto:** os do CA1, do CA2 e do CA4.

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o navegador em `Asia/Tokyo`, quando a Pessoa abre o chat e depois o próprio
Perfil, então o painel mostra a hora atual de Tóquio com "no horário local"; o Perfil de quem nunca
abriu o chat não mostra a linha.

**Teste previsto:** Playwright, `e2e/perfil/hora-local.spec.ts`, "mostra a hora no fuso da Pessoa"
e "sem fuso, a linha não aparece".

## Contrato

### PUT /v1/people/me/time-zone · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Cookie de Sessão (guard da F01) |
| Corpo da requisição | `time_zone`: texto obrigatório, um fuso IANA que o `Intl.DateTimeFormat` do Node reconhece, até 64 caracteres |
| Resposta de sucesso | 204, sem corpo |
| Erros | 400 `validation_failed`; 401 `unauthenticated` |

### POST /v1/sessions e GET /v1/sessions/current · alteradas

Resposta de sucesso: a `person` ganha `time_zone` (texto ou nulo).

## Verificação do contrato

- `PUT /v1/people/me/time-zone` 204, 400 e 401: CA1.
- `time_zone` na Pessoa das duas rotas de Sessão: CA2.

## Decisões

- **Rota no `ProfilesController`:** `@Put('me/time-zone')` com `@HttpCode(204)`, ao lado do
  `GET :id`; os métodos diferentes não colidem. Um `SaveTimeZoneDto` com `@IsString`,
  `@MaxLength(64)` e um validador que monta um `Intl.DateTimeFormat` com o fuso.
- **Gravação idempotente:** `PeopleService.saveTimeZone(personId, timeZone)` faz o `UPDATE` direto;
  o mesmo fuso não muda nada visível.
- **Web:** `Person` ganha `timeZone`. O layout passa o `timeZone` da Pessoa ao `TimeZoneSync`, que,
  além do cookie, compara o fuso do navegador com ele e chama `saveTimeZone` uma vez, guardada num
  `ref`. O resultado não é mostrado; o 401 já leva a "Entrar" pela próxima leitura.
- **Hora local:** `localTimeLabel(timeZone, now)` reaproveita o `formatTime` da F02, e
  `msUntilNextMinute(now)` dá o atraso do `setTimeout` que atualiza a linha na virada do minuto. A
  linha usa o ícone `Clock`, como no Figma ("Local time").

## Arquivos e interfaces

- `apps/chat-api/src/profiles/profiles.controller.ts` e `save-time-zone.dto.ts`.
- `apps/chat-api/src/people/people.service.ts`: `saveTimeZone`.
- `apps/chat-api/src/sessions/person.response.ts`: `time_zone`.
- `apps/web/src/app/actions/save-time-zone.ts` e `services/chat-api.ts` (`saveTimeZone`, `Person`).
- `apps/web/src/app/components/session/time-zone-sync.tsx` e `(app)/layout.tsx`.
- `apps/web/src/app/utils/local-time.ts` e `local-time.test.ts`.
- `apps/web/src/app/components/profile/profile-panel.tsx`: a linha da hora local.
- `apps/web/e2e/perfil/hora-local.spec.ts`, `e2e/support/database.ts` (`timeZoneOf`) e
  `e2e/plano-de-testes-f05.md`.

## Testes existentes que mudam

- `test/sessions.e2e-spec.ts`: a Pessoa da resposta ganha `time_zone`.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum. O LLD já registra a rota e a alteração do cookie de fuso como `planejadas`.
