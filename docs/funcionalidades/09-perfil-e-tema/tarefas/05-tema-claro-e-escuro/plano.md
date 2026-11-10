# Plano da F09-T05: Tema claro e escuro

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de ponta a ponta da API

**Cenário:** A migração acrescenta `theme`, com `light` por padrão e CHECK; `PUT /v1/people/me/theme`
grava (204), recusa valor fora da lista com `validation_failed` (400), responde 401 sem Sessão e não
publica evento; `GET /v1/sessions/current` e a resposta de entrar trazem o `theme`.

**Teste previsto:** `test/people-theme.e2e-spec.ts` e `test/database.e2e-spec.ts`.

### CA2

**Marca:** teste no Playwright

**Cenário:** Dado o tema escuro gravado na Pessoa, quando ela entra num navegador novo, então o HTML
que chega já tem `data-theme="dark"` e `color-scheme` escuro antes da hidratação; sem Sessão, a tela
"Entrar" fica no claro.

**Teste previsto:** Playwright, `e2e/tema/tema.spec.ts`, "o tema vem aplicado num navegador novo" e
"Entrar fica no claro".

### CA3

**Marca:** teste no Playwright

**Cenário:** O ThemeToggle, no Rail acima do avatar, tem o nome acessível "Mudar para o tema escuro"
(lua) ou "Mudar para o tema claro" (sol); o clique troca o tema na hora, grava e troca também a
outra aba do mesmo navegador.

**Teste previsto:** Playwright, `e2e/tema/tema.spec.ts`, "troca o tema nas duas abas".

### CA4

**Marca:** teste no Playwright

**Cenário:** Com a Server Action respondendo erro, o tema volta ao anterior e o toast "Não foi
possível trocar o tema" aparece.

**Teste previsto:** Playwright, `e2e/tema/tema.spec.ts`, "a falha volta ao tema anterior".

### CA5

**Marca:** documento

**Cenário:** No `docs/design-system.md`, "Tema claro e escuro" aponta para o LLD ("Cliente",
"Tema") em vez de dizer que o lugar da escolha está a definir.

### CA6

**Marca:** teste no Playwright

**Cenário:** Tudo pelo teclado (o ThemeToggle é um botão no Rail), e o axe nas telas principais
(Conversa e Atividade), nos dois temas, sem violações.

**Teste previsto:** Playwright, `e2e/tema/tema.spec.ts` (teclado) e
`e2e/acessibilidade/tema-sem-violacoes.spec.ts`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, com o Rail e o botão de tema nos
dois temas ao lado do frame; e `roteiro-manual.md`, com o Lighthouse nos dois temas a executar.

## Contrato

### people · chat · alterada

- `theme`: texto, obrigatório, padrão `'light'`, CHECK `theme IN ('light', 'dark')`, escrito à mão
  na migração.

### `PUT /v1/people/me/theme` · nova

- Autenticação: Sessão. Corpo: `theme` (`light` ou `dark`). Sucesso: 204. Erros:
  `validation_failed` (400), `unauthenticated` (401). Não publica evento.

### `GET /v1/sessions/current` e `POST /v1/sessions` · alteradas

- A Pessoa ganha `theme`.

### Cookie `theme` (web) · novo

- Gravado pelo servidor ao entrar e pela Server Action `saveTheme`, e pelo cliente ao trocar; sem
  `HttpOnly`, `Path=/`, `SameSite=Lax`, com a `validade do cookie de sessão`; apagado ao sair.

## Verificação do contrato

- Coluna, CHECK, rota e Pessoa da Sessão: CA1.
- Cookie e aplicação antes da hidratação: CA2.

## Decisões

- **Tema na primeira pintura por um cookie que espelha a Pessoa.** O projeto usa Cache Components:
  o layout raiz não pode ler a Sessão fora de um `<Suspense>`, e o `<html>` não pode ficar dentro de
  um. Por isso, um script curto e bloqueante no `<head>` lê o cookie `theme` e põe o `data-theme`
  e o `color-scheme` no `<html>` antes da pintura, fora de "Entrar". A escolha continua gravada na
  Pessoa (spec da F09, "Tema"): entrar grava o cookie com o tema dela, o que cobre o navegador novo,
  e o layout das telas logadas o corrige quando a Pessoa trocou o tema em outro navegador. Sair
  apaga o cookie. O `<html>` leva `suppressHydrationWarning`, porque o script muda o atributo antes
  da hidratação. A spec e o LLD registram a troca.
- **Troca.** O ThemeToggle aplica o tema na hora, grava o cookie, avisa as outras abas por um
  `BroadcastChannel("theme")` e chama `saveTheme`; na falha, volta ao anterior nas abas e mostra o
  toast.

## Arquivos e interfaces

- **API:** migração `AddPersonTheme`; `person.entity.ts`, `profile-values.ts` (`THEMES`),
  `people.service.ts` (`saveTheme`), `profiles.controller.ts`, `save-theme.dto.ts`,
  `sessions/person.response.ts`.
- **Web:** `app/layout.tsx` (script e `suppressHydrationWarning`), `utils/theme.ts`,
  `services/theme-cookie.ts`, `actions/save-theme.ts`, `actions/login.ts`, `actions/logout.ts`,
  `components/workspace-nav/theme-toggle.tsx`, `rail.tsx`, `components/session/theme-sync.tsx`.

## Testes existentes que mudam

- Os que comparam o formato exato da Pessoa da Sessão ganham `theme`.

## Mudança de dados

A coluna nova, com `light` para quem já existe.

## Documentos atualizados

- `docs/funcionalidades/09-perfil-e-tema/spec.md`, "Cliente", "Tema": o cookie que espelha a Pessoa.
- `docs/lld.md`, "Cliente", "Tema" e "Cookies do cliente": o cookie `theme`.
- `docs/design-system.md`, "Tema claro e escuro": o ponteiro para o LLD (CA5).
