# Validação visual da aba Tarefas e das Notificações de Tarefa (F12-T06, CA5)

Comparação da web com os frames da seção "Tarefas (F12)" do Figma (`202:53977`), em 1440 × 900,
nos temas claro e escuro, pelo fluxo de `docs/design-system.md`, "Validação visual".

**Como foi capturado.** Um script descartável do Playwright, no contêiner `e2e`, criou as Pessoas
(Leonan, Regina, Rafael, Alfredo), quatro Canais e as Tarefas pela rota do bot (`support/bot.ts`):
duas recebidas (uma aberta, uma concluída), três delegadas (uma aberta, uma concluída e uma com o
Pedido apagado), e as Notificações de Tarefa que essas ações geram (recebida, concluída e
reaberta). O tema foi trocado pelo campo `theme` da Pessoa. A aba vazia usa uma Pessoa nova. O
script foi apagado depois das capturas.

**O que não conta como divergência.** Os dados de exemplo (nomes de Canal com sufixo, "12 nov",
"agora", cor do avatar, que vem do id, e os contadores das abas), a barra lateral (sem Conversas
diretas e com "Ver agentes" porque a Pessoa de teste não é administradora) e a renderização do
Lato no Chromium do contêiner, que deixa todo texto alguns pixels mais largo que no Figma em todas
as telas, inclusive nas que já estavam validadas.

## Capturas

| Tela | Claro | Escuro | Frames do Figma |
| --- | --- | --- | --- |
| Tarefas, Recebidas e Delegadas, com Pedido apagado | `tarefas-claro.png` | `tarefas-escuro.png` | `202:53978`, `202:54297` / `202:55174`, `202:55192` |
| Tarefa em destaque (`?tarefa=`) | `tarefa-em-destaque-claro.png` | `tarefa-em-destaque-escuro.png` | `202:54616` / `202:55210` |
| Tarefas vazia | `tarefas-vazio-claro.png` | `tarefas-vazio-escuro.png` | `202:54935` / `202:55228` |
| Todas, com Notificações de Tarefa | `todas-com-notificacoes-de-tarefa-claro.png` | `todas-com-notificacoes-de-tarefa-escuro.png` | `204:55682` / `204:56587` |

## Tarefas (Recebidas, Delegadas e Pedido apagado)

| Item | Resultado |
| --- | --- |
| Cabeçalho, abas, aba ativa com sublinhado `success`, rótulos dos grupos (TaskGroupHeader) | Confere |
| Linha: padding 12/20, borda inferior `border-subtle`, título 15/22 bold, título concluído em `fg-muted` | Confere |
| Cores nos dois temas (fundo, texto, pílulas, link `link`, verde do Concluída) | Confere |
| Pedido apagado: "Mensagem apagada" em itálico no lugar de "Ver Pedido" | Confere |
| Delegadas sem botão, só a pílula | Confere |
| **D1.** Linha de metadados em `text-small` (13/18); no Figma é `caption` 12/16. A linha fica 3 px mais alta (70 px contra 67 px) | **A corrigir** |
| **D2.** Metadados separados por "·"; no Figma são só os textos com intervalo de 8 px, sem separador | **A corrigir** |
| **D3.** A pílula de estado fica na linha do título, alinhada ao topo; no Figma a pílula e o botão são irmãos do bloco de conteúdo, centralizados na vertical da linha (pílula e botão na mesma altura) | **A corrigir** |
| **D4.** Pílula com 16 px de altura (sem padding vertical) e check de 12 px; no Figma tem 20 px (padding 2/8) e check de 16 px | **A corrigir** |
| **D5.** Botões Concluir e Reabrir sem ícone; no Figma têm ícone de 16 px à esquerda (`check` e `rotate-ccw`) e rótulo 13/18 bold, com 99 px de largura no Concluir | **A corrigir** |
| Contador "5" na aba Tarefas ao vê-la: as Notificações de Tarefa continuam não lidas até serem abertas; o frame do Figma só não tem Notificações | Aceitável (dados) |

## Tarefa em destaque

| Item | Resultado |
| --- | --- |
| Fundo `highlight-bg`, borda esquerda de 4 px `highlight-border`, conteúdo deslocado 4 px, "Ver Pedido" no tom `link-hover` | Confere, nos dois temas |
| Anel de foco azul em volta da linha, que recebe o foco ao abrir pelo link; o frame não mostra o foco | Aceitável (o foco visível é requisito de acessibilidade) |
| D1 a D5 também valem aqui | A corrigir (mesmo componente) |

## Tarefas vazia

| Item | Resultado |
| --- | --- |
| Ícone em quadro `surface-inset` 48 px, "Nenhuma Tarefa" bold, texto em `fg-muted` centralizado em duas linhas, posição vertical | Confere, nos dois temas |
| "Marcar tudo como lido" desabilitado sem Notificações não lidas; o frame mostra o botão ativo | Aceitável (estado correto para a Pessoa sem Notificações) |

## Todas, com Notificações de Tarefa

| Item | Resultado |
| --- | --- |
| NotificationItem não lido: fundo `highlight-bg`, título bold, ponto vermelho, avatar de quem agiu, `Excerpt` com o título da Tarefa | Confere, nos dois temas |
| Textos "delegou uma Tarefa a você", "concluiu uma Tarefa", "reabriu uma Tarefa" | Confere |
| Contadores nas abas Todas e Tarefas | Confere |
| Notificação lida (fundo neutro, título regular) não capturada: todas estavam não lidas; o estado lido é do NotificationItem da F08, sem mudança na F12 | Aceitável |

## Divergências a corrigir

Todas no TaskItem (`apps/web/src/app/components/task/task-item.tsx`):

- **D1.** Metadados de `text-small` para `text-caption`; "Mensagem apagada" fica em 13 px
  itálico, como no frame "Pedido apagado".
- **D2.** Tirar os `<span aria-hidden>·</span>` e manter o `gap-x-2`.
- **D3.** Tirar a pílula da linha do título e pô-la, com o botão, como irmã do bloco de conteúdo,
  com a linha em `items-center`.
- **D4.** Pílula com `py-0.5` e `Check` de 16 px.
- **D5.** Passar o ícone ao `Button` (`icon={Check}` no Concluir e `icon={RotateCcw}` no Reabrir),
  que já desenha o ícone de 16 px (`apps/web/src/app/components/ui/button.tsx`).

## Correções aplicadas

As cinco divergências "a corrigir" (D1 a D5) foram corrigidas no `TaskItem`: a linha de metadados em
`text-caption`, sem os separadores `·`; a pílula de estado fora da linha do título, centrada na
vertical, com 20 px de altura e o check de 16 px; e os ícones `check` e `rotate-ccw` nos botões
Concluir e Reabrir. Os testes do Playwright da aba e o axe nos dois temas continuam passando. As
capturas acima são de antes das correções.
