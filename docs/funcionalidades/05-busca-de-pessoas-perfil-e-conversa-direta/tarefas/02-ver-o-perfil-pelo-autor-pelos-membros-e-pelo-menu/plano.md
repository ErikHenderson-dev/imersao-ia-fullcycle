# Plano da F05-T02: Ver um Perfil pelo autor da Mensagem, pela lista de Membros e pelo menu do avatar

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre o Figma (arquivo `slack`, página Telas) e encontra, na seção "Painel de
perfil", o frame "Painel de perfil / Sem cargo, telefone e hora local", e, no menu do avatar, o item
"Perfil" antes de "Sair do Full Cycle". Os dois são feitos antes do código das telas.

### CA2

**Marca:** teste HTTP

**Cenário:** Dada uma Pessoa com Sessão e outra com cargo e telefone, quando a primeira pede
`GET /v1/people/:id` da outra, então recebe 200 com `id`, `name`, `username`, `title`, `email`,
`phone` e `time_zone`; da Pessoa sem os opcionais, os três vêm nulos; um id malformado e um id que
não é de Pessoa recebem 404 `person_not_found`; sem Sessão, 401.

**Teste previsto:** e2e da API, `test/people-profile.e2e-spec.ts`, "responde 200 com o Perfil
completo", "responde 200 com cargo, telefone e fuso nulos", "responde 404 person_not_found para
%s" (`it.each`, malformado e inexistente) e "responde 401 sem Sessão".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dado o painel aberto pela web, quando o Perfil carrega, então ele vem da rota do BFF com
as iniciais; quando a Sessão acaba, a leitura leva a "Entrar".

**Teste previsto:** Playwright, `e2e/perfil/ver-perfil.spec.ts`, coberto pelos cenários do CA5 e
pelo caso "a Sessão vencida leva a Entrar ao abrir o Perfil".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dado o painel aberto, quando a pessoa troca de Conversa, ele continua aberto; quando
abre outro Perfil, o conteúdo troca; quando aperta Esc ou clica no X, ele fecha e o foco volta ao
que o abriu. Em 1024 px de largura ele sobrepõe a Conversa, e em 600 px ocupa a largura toda.

**Teste previsto:** Playwright, `e2e/perfil/painel-de-perfil.spec.ts`, "continua aberto ao trocar
de Conversa", "troca o conteúdo ao abrir outro Perfil", "Esc fecha e devolve o foco" e "sobrepõe a
Conversa em telas estreitas".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado o Perfil de outra Pessoa, quando ele abre, então mostra o avatar, o nome, o cargo,
o `@usuário`, o botão "Mensagem" e, em "Informações de contato", o e-mail (link `mailto:`) e o
telefone; sem cargo e telefone, essas linhas não aparecem; o próprio Perfil não tem "Editar
perfil"; a API em 404 mostra "Pessoa não encontrada"; outra falha mostra "Não foi possível carregar
o perfil" com "Tentar de novo", que carrega de novo.

**Teste previsto:** Playwright, `e2e/perfil/ver-perfil.spec.ts`, "mostra o Perfil de outra
Pessoa", "esconde cargo e telefone que não existem", "o próprio Perfil não tem Editar perfil",
"mostra Pessoa não encontrada" e "tenta de novo depois da falha ao carregar" (as duas falhas pelo
`page.route`).

### CA6

**Marca:** teste no Playwright

**Cenário:** Quando a pessoa clica no nome ou no avatar do autor de uma Mensagem, ou escolhe uma
Pessoa em "Membros de #nome", ou "Perfil" no menu do avatar, então o painel abre com o Perfil
dessa Pessoa; o diálogo de Membros fecha antes.

**Teste previsto:** Playwright, `e2e/perfil/ver-perfil.spec.ts`, "abre pelo autor da Mensagem",
"abre pela lista de Membros" e "abre o próprio Perfil pelo menu do avatar", pelo teclado.

### CA7

**Marca:** teste HTTP

**Cenário:** O mesmo do CA2: os testes da API provam o Perfil completo, sem os opcionais, os 404 e
o 401.

**Teste previsto:** os do CA2.

### CA8

**Marca:** teste no Playwright

**Cenário:** O axe não encontra violações com o painel aberto, e os casos do CA4 ao CA6 rodam pelo
teclado.

**Teste previsto:** Playwright, `e2e/acessibilidade/perfil-sem-violacoes.spec.ts`,
"perfil-sem-violacoes".

### CA9

**Marca:** revisão humana

**Cenário:** Quem revisa abre `validacao-visual.md` desta pasta e encontra as capturas do painel nos
estados Carregando, Outra pessoa, Próprio perfil, Pessoa não encontrada e Erro ao carregar, nos dois
temas, ao lado do `get_screenshot` dos frames, sem diferença além da presença, do status, do selo e
da hora local, que ficam fora.

## Contrato

### GET /v1/people/:id · nova

| Item | Descrição |
| --- | --- |
| Autenticação | Cookie de Sessão (guard da F01) |
| Parâmetros de caminho | `id`: texto; um valor que não é UUID responde como Pessoa inexistente |
| Resposta de sucesso | 200 com `person`: `id` (uuid), `name`, `username`, `title` (texto ou nulo), `email`, `phone` (texto ou nulo), `time_zone` (texto ou nulo) |
| Erros | 404 `person_not_found`; 401 `unauthenticated` |

### GET /api/people/:id · nova (BFF)

| Item | Descrição |
| --- | --- |
| Chama | `GET /v1/people/:id`, com o cookie de Sessão |
| Autenticação | Cookie de Sessão do navegador |
| Resposta de sucesso | 200 com o Perfil no formato da web: `id`, `name`, `initials`, `username`, `title`, `email`, `phone`, `timeZone` |
| Erros | 404 `{ kind: "not_found" }`; 401 `{ kind: "unauthenticated" }`; 502 `{ kind: "failure" }` |

## Verificação do contrato

- `GET /v1/people/:id` 200 e os dois 404 e o 401: CA2.
- `GET /api/people/:id` 200: CA5; 404: CA5 (Pessoa não encontrada); 502: CA5 (falha ao carregar);
  401: CA3.

## Decisões

- **Rota no módulo `people`:** um `PeopleController` novo, com `@Controller('people')` e
  `@Get(':id')`; o `PeopleService` ganha `getProfile(id)`, que trata o id que não é UUID como
  inexistente. O `PersonNotFoundError` passa a aceitar o e-mail como opcional, para a mensagem do
  comando continuar; o filter já traduz `person_not_found` em 404.
- **Perfil na web:** `getProfile` no service do BFF e a rota `GET /api/people/[id]`, no mesmo
  formato de resultado da busca de Pessoas.
- **Provedor do painel:** `ProfilePanelProvider`, no layout das telas logadas, por dentro do
  `RealtimeProvider`, com `useProfilePanel()`: `personId`, `openProfile(personId, returnFocusTo?)`
  e `closeProfile()`. Sem `returnFocusTo`, guarda o `document.activeElement` da abertura. Ao fechar,
  devolve o foco a ele, se ainda estiver na página.
- **Painel no shell:** `ProfilePanel` é um `<aside aria-label="Perfil">` depois do `<main>`,
  dentro do `NavigationDrawer`, com `w-panel` e a borda à esquerda a partir de `xl`. Abaixo de `xl`
  fica `absolute` à direita, sobre a Conversa, com `shadow-3` e `z-20`; abaixo de `sm`, largura
  total. Entra com `animate-slide-in`. Esc dentro do painel fecha. Ao abrir, o foco vai para o
  botão "Fechar perfil".
- **Lista de Membros:** a PersonRow vira um botão. Escolher uma Pessoa fecha o diálogo e abre o
  painel com `returnFocusTo` no botão de Membros; o `onCloseAutoFocus` do diálogo não devolve o
  foco ao botão, para ele ficar no painel.
- **Autor da Mensagem:** o nome vira um botão, e o avatar, um botão com `tabIndex={-1}` e
  `aria-hidden`, para a Mensagem ter uma parada de teclado só. A forma compacta não tem autor à
  vista e não muda.
- **"Mensagem" desabilitado até a 04:** o botão aparece, como diz a tarefa, mas `disabled`, porque
  só a 04 cria a Conversa direta.
- **Avatar `xl`:** o Avatar ganha o tamanho `xl` (96 px) do design system, usado no painel.
- **Hora local fora:** a linha só entra com a 03.

## Arquivos e interfaces

- `apps/chat-api/src/people/people.controller.ts` e `people.module.ts`: a rota.
- `apps/chat-api/src/people/people.service.ts`: `getProfile(id)`.
- `apps/chat-api/src/people/profile.response.ts`: `ProfileResponse` e `toProfileResponse`.
- `apps/chat-api/src/people/person-not-found.error.ts`: e-mail opcional.
- `apps/web/src/app/services/chat-api.ts`: `Profile` e `getProfile`.
- `apps/web/src/app/api/people/[id]/route.ts`.
- `apps/web/src/app/components/profile/profile-panel-provider.tsx`, `profile-panel.tsx` e
  `profile-content.tsx`.
- `apps/web/src/app/(app)/layout.tsx`: o provedor e o painel.
- `apps/web/src/app/components/ui/avatar.tsx`: tamanho `xl`.
- `apps/web/src/app/components/message/message-item.tsx`: o autor como botão.
- `apps/web/src/app/components/conversation/members-dialog.tsx` e `members-button.tsx`: a
  PersonRow como botão e o fechamento do diálogo.
- `apps/web/src/app/components/user/user-menu.tsx`: o item "Perfil".
- `apps/web/e2e/perfil/*.spec.ts`, `apps/web/e2e/acessibilidade/perfil-sem-violacoes.spec.ts` e
  `apps/web/e2e/plano-de-testes-f05.md`.

## Testes existentes que mudam

- Os testes do Playwright que procuram o autor da Mensagem pelo texto continuam valendo; os que
  usam `getByRole` no histórico podem achar o botão novo do nome. Ajustes só de seletor.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum. O LLD já registra a rota como `planejada` (spec da F05).
