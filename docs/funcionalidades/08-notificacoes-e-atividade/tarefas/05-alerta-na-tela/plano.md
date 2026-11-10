# Plano da F08-T05: Alerta na tela

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre o Figma, página Telas, e encontra "Portas / Toast de atividade"
(19:3399) com o Alerta acima do campo de envio, sem cobri-lo.

### CA2

**Marca:** teste de unidade

**Cenário:** Dada uma Notificação, quando o cliente decide para onde ela vai, então com a aba em foco
e a Conversa da Mensagem aberta, nada; com a aba em foco e outra tela, Alerta; com a aba sem foco,
nada (o navegador fica para a 06); sem tipo de Notificação, nada.

**Teste previsto:** Vitest, `src/app/utils/notification-destination.test.ts`, "para onde vai a
Notificação".

### CA3

**Marca:** teste no Playwright

**Cenário:** Dada uma queda de conexão, quando uma Menção chega durante ela e a rede volta, então a
aba não mostra Alerta, e a Menção conta no rail.

**Teste previsto:** Playwright, `e2e/atividade/alerta.spec.ts`, "o que chegou durante a queda não
alerta".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Menção num Canal, quando ela chega com outra Conversa aberta, então o Alerta
mostra "<autor> mencionou você em #<canal>", o começo do texto e "Abrir"; uma Mensagem direta mostra
"<autor> enviou uma mensagem direta"; o Alerta some pelo botão de fechar; vários Alertas se empilham
acima do campo de envio, que continua visível e clicável.

**Teste previsto:** Playwright, `e2e/atividade/alerta.spec.ts`, "a Menção e a Mensagem direta
alertam na aba em foco" e "o Alerta fica acima do campo de envio e fecha"; a duração (8 s) é a do
LLD ("Valores de regra"), passada ao toast.

### CA5

**Marca:** teste no Playwright

**Cenário:** Dado o Alerta na tela, quando o leitor de tela e o teclado o alcançam, então ele está
numa região `aria-live` educada, o foco continua onde estava, e "Abrir" e fechar são alcançáveis
pelo atalho do Sonner (Alt+T) e Tab.

**Teste previsto:** Playwright, `e2e/atividade/alerta.spec.ts`, "o Alerta não tira o foco e é
alcançável pelo teclado".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado o Alerta, quando a Pessoa escolhe "Abrir", então a Conversa abre na Mensagem e a
Notificação fica lida: o rail baixa nas duas abas.

**Teste previsto:** Playwright, `e2e/atividade/alerta.spec.ts`, "Abrir leva à Mensagem e baixa o
rail".

### CA7

**Marca:** teste no Playwright

**Cenário:** Duas abas da Pessoa, uma em foco: só a em foco mostra o Alerta; com a Conversa da
Mensagem aberta e em foco, nenhuma alerta; o axe com o Alerta na tela não acha violações.

**Teste previsto:** Playwright, `e2e/atividade/alerta.spec.ts`, "só a aba em foco alerta", "a
Conversa aberta em foco não alerta" e `e2e/acessibilidade/alerta-sem-violacoes.spec.ts`.

### CA8

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o Alerta nos dois temas,
ao lado do frame.

## Contrato

O contrato não muda. No cliente, a assinatura do tempo real passa a dizer se a Mensagem veio do
reenvio da reconexão (`onMessage(message, { isReplay })`).

## Verificação do contrato

Nenhum item.

## Decisões

- O provedor de tempo real marca como reenvio os eventos aplicados no `sync` de cada conexão (os
  guardados enquanto ela sincronizava), e repassa a marca a quem assina `onMessage`. É o "só alerta
  depois do `sync`" da spec.
- Um componente do cliente no layout logado (`AlertCenter`) ouve `message.created`, decide o tipo
  pela função da 03 (`notificationKindFor`) e o destino por uma função pura nova
  (`notificationDestination`), que a 06 estende com o navegador.
- A Conversa vem da lista de Conversas no cache ou, numa Conversa direta nova, do evento de entrada,
  como na tela Atividade.
- O Alerta é um toast do Sonner com título, descrição em até duas linhas e a ação "Abrir", com a
  "Duração do Alerta" do LLD. O Toaster ganha um afastamento do fundo que o deixa acima do campo de
  envio, em todos os toasts.
- "Abrir" navega para o endereço da Mensagem (`messageHref`), e a ida da 02 a abre.

## Arquivos e interfaces

- `apps/web/src/app/components/realtime/realtime-provider.tsx`: a marca de reenvio.
- `apps/web/src/app/utils/notification-destination.ts`: `notificationDestination`,
  `ALERT_DURATION_MS`.
- `apps/web/src/app/components/notification/alert-center.tsx` e `(app)/layout.tsx`.
- `apps/web/src/app/components/ui/toaster.tsx`: o afastamento e as classes da descrição.
- `apps/web/e2e/atividade/alerta.spec.ts`, `e2e/acessibilidade/alerta-sem-violacoes.spec.ts`.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum no commit de plano: o frame do Figma muda na implementação (CA1), e o LLD já tem a "Duração
do Alerta".
