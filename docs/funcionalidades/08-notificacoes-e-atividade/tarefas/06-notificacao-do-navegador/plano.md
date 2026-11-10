# Plano da F08-T06: Notificação do navegador

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste de unidade

**Cenário:** Dada a permissão do navegador e a opção guardada, quando o menu decide o estado, então
sem a API de notificação é "sem suporte" (o item não aparece); com a permissão `denied`, "bloqueada";
com `granted` e a opção ligada, "ligada"; em qualquer outro caso, "desligada".

**Teste previsto:** Vitest, `src/app/utils/browser-notifications.test.ts`, "o estado da opção do
navegador"; Playwright, os do CA6, que provam o pedido de permissão só ao ativar.

### CA2

**Marca:** teste de unidade

**Cenário:** Dado o foco das abas de um navegador, quando uma aba avisa foco, perde o foco, abre ou
fecha, então o conjunto das abas em foco acompanha, e "alguma aba em foco" é verdadeiro só com ao
menos uma.

**Teste previsto:** Vitest, `src/app/utils/tab-presence.test.ts`, "o conjunto das abas em foco";
Playwright, o do CA4, com duas abas.

### CA3

**Marca:** teste de unidade

**Cenário:** Dada uma Notificação sem nenhuma aba em foco, quando o destino é decidido, então vai ao
navegador com a opção ligada e a permissão dada, e a lugar nenhum sem elas; com alguma aba em foco
(esta ou outra), não vai ao navegador.

**Teste previsto:** Vitest, `src/app/utils/notification-destination.test.ts`, "o navegador só sem
nenhuma aba em foco".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dadas duas abas sem foco, a opção ligada e a permissão concedida pelo contexto, quando
chega uma Menção, então as duas criam a notificação com o mesmo `tag` (o id da Mensagem), e o
navegador mostra uma só; com uma aba em foco, nenhuma cria.

**Teste previsto:** Playwright, `e2e/atividade/notificacao-do-navegador.spec.ts`, "sem aba em foco
sai uma notificação só" e "com uma aba em foco não sai notificação".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada a notificação do navegador, quando a Pessoa clica nela, então a aba que a criou vem
para a frente (`window.focus`) e abre a Conversa na Mensagem.

**Teste previsto:** Playwright, `e2e/atividade/notificacao-do-navegador.spec.ts`, "o clique abre a
Mensagem", com o clique simulado na notificação instrumentada.

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o menu da conta, quando a permissão está `default`, então mostra "Ativar
notificações do navegador" e, ao escolher, pede a permissão; com `granted`, passa a "Desativar
notificações do navegador", e desativar volta a "Ativar"; com `denied`, mostra "Bloqueadas neste
navegador", desabilitado; a escolha continua depois de recarregar.

**Teste previsto:** Playwright, `e2e/atividade/notificacao-do-navegador.spec.ts`, "ativar pede a
permissão e liga a opção", "desativar desliga a opção" e "com a permissão negada, a opção fica
bloqueada".

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md` e `roteiro-manual.md`, nesta pasta, e encontra
os três estados do menu nos dois temas, ao lado dos frames, e o roteiro da notificação de verdade no
Chrome.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhum item.

## Decisões

- A opção fica no `localStorage`, na chave `fc:browser-notifications`, e só vale com a permissão
  `granted`. Um navegador sem `Notification` não mostra o item.
- O foco entre abas sai de um `BroadcastChannel` (`fc:tab-focus`): cada aba tem um id, avisa quando
  ganha ou perde o foco e quando fecha (`pagehide`), e pergunta o estado às outras ao abrir. O
  conjunto das abas em foco é uma função pura sobre essas mensagens.
- `notificationDestination` ganha o destino "navegador": sem foco nesta aba nem em outra, com a
  opção ligada.
- Todas as abas sem foco criam a notificação com o `tag` do id da Mensagem, e o navegador mostra uma
  só. O clique chama `window.focus()`, navega para o endereço da Mensagem e fecha a notificação.
- O item do menu segue os frames: sino para ativar, sino cortado para desativar, e a segunda linha
  "Bloqueadas neste navegador" com o item desabilitado.

## Arquivos e interfaces

- `apps/web/src/app/utils/browser-notifications.ts`: o estado, a leitura e a gravação da opção.
- `apps/web/src/app/utils/tab-presence.ts` e `hooks/use-any-tab-focused.ts`: o foco entre abas.
- `apps/web/src/app/hooks/use-browser-notifications.ts`: o estado e as ações do menu.
- `apps/web/src/app/utils/notification-destination.ts`: o destino "navegador".
- `apps/web/src/app/components/notification/alert-center.tsx`: a notificação do navegador.
- `apps/web/src/app/components/user/user-menu.tsx`: o item da opção.
- `apps/web/e2e/atividade/notificacao-do-navegador.spec.ts`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec e o LLD já descrevem a opção e a notificação como `planejadas`.
