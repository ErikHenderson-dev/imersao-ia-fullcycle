# Plano da F07-T04: Abrir na primeira Não lida, com o divisor

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra o UnreadDivider da web
ao lado do frame "Conversa / Lista / Divisor de novas mensagens" (21:7793): linha `danger`, rótulo
"Novas mensagens" em `small/bold` e `danger-fg`, sobre `surface`, à direita.

### CA2

**Marca:** teste de unidade

**Cenário:** Dada a lista carregada e a Última leitura guardada ao abrir, quando o cliente procura a
primeira Não lida, então é a primeira Mensagem de outro autor com id posterior à Última leitura (ou
a primeira de outro autor, com ela nula); as próprias Mensagens não contam; sem nenhuma, não há
divisor; com a primeira Não lida apagada (fora da lista), é a seguinte.

**Teste previsto:** Vitest, `src/app/utils/unread-opening.test.ts`, "a primeira Não lida é a
primeira de outro autor depois da Última leitura" e "sem Não lidas não há divisor".

### CA3

**Marca:** teste de unidade

**Cenário:** Dada a lista carregada, quando ela começa depois da Última leitura e há páginas
anteriores, então é preciso carregar mais antes de posicionar; com a Última leitura nula, até o
começo; quando a lista já começa nela ou antes, ou não há anteriores, não.

**Teste previsto:** Vitest, `src/app/utils/unread-opening.test.ts`, "carrega as anteriores até a
Última leitura".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Conversa aberta com a aba em foco, quando a aba perde o foco, chega uma
Mensagem e o foco volta, então o divisor aparece acima dela, e a rolagem não muda.

**Teste previsto:** Playwright, `e2e/nao-lidas/abrir-na-primeira.spec.ts`, "ao voltar o foco, o
divisor fica acima da primeira Mensagem que chegou sem foco".

### CA5

**Marca:** teste de unidade

**Cenário:** O dos CA2 e CA3.

**Teste previsto:** os dos CA2 e CA3.

### CA6

**Marca:** teste no Playwright

**Cenário:** Dada uma Conversa com mais Não lidas que uma página, quando a Pessoa a abre, então ela
mostra "Indo até a mensagem", chega à primeira Não lida e mostra o divisor acima dela, à vista; com
poucas Não lidas, abre no fim com o divisor; o axe com o divisor à vista não acha violações.

**Teste previsto:** Playwright, `e2e/nao-lidas/abrir-na-primeira.spec.ts`, "vai até a primeira Não
lida com mais Não lidas que uma página" e "com poucas Não lidas abre no fim, com o divisor";
`e2e/acessibilidade/divisor-sem-violacoes.spec.ts`.

### CA7

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md` e encontra as capturas do divisor e de "Indo até
a mensagem", nos dois temas, ao lado dos frames.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhum item.

## Decisões

- A Última leitura guardada ao abrir é a da Conversa que a página lê (`lastReadMessageId`, da
  F07-T02), e só vale com `unreadCount` maior que zero naquele momento: sem Não lidas ao abrir, não
  há divisor.
- A primeira Não lida e a necessidade de carregar as anteriores são funções puras sobre a lista.
- A busca das anteriores reaproveita o mecanismo da ida da F06-T07 (páginas de 100, estado "Indo
  até a mensagem"), com outro alvo: carregar até a lista começar na Última leitura ou antes.
- O divisor vai dentro do item da primeira Não lida, depois do divisor de dia, como o DayDivider,
  para a lista continuar só com itens de Mensagem.
- Ao posicionar: a lista já abre no fim; se o divisor ficou acima da área visível, ele rola para o
  topo dela.
- Ao voltar o foco, se a Mensagem salva mais nova é de outro autor e posterior à Última leitura que
  o aviso de leitura conhece, essa Última leitura vira a nova referência do divisor; o hook do
  aviso a expõe. A rolagem não muda.

## Arquivos e interfaces

- `apps/web/src/app/utils/unread-opening.ts`: `firstUnreadId` e `needsOlderForUnread`.
- `apps/web/src/app/components/message/unread-divider.tsx`: UnreadDivider.
- `apps/web/src/app/components/message/message-item.tsx`: `unreadDivider`.
- `apps/web/src/app/hooks/use-read-report.ts`: devolve a Última leitura conhecida.
- `apps/web/src/app/components/conversation/message-history.tsx`: a referência do divisor, a busca
  das anteriores e o posicionamento.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum: a spec da F07 já descreve a abertura, o divisor e a volta do foco.
