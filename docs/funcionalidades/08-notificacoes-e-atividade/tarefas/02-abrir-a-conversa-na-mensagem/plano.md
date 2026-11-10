# Plano da F08-T02: Abrir a Conversa na Mensagem

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com 160 Mensagens, quando a Pessoa abre
`/conversas/:id?mensagem=<id da Mensagem 10>`, então a Conversa mostra "Indo até a mensagem…",
carrega as páginas anteriores, rola até a Mensagem 10 e a destaca, e o destaque some depois de 2 s.

**Teste previsto:** Playwright, `e2e/atividade/abrir-na-mensagem.spec.ts`, "vai até a Mensagem
fora da primeira página e a destaca".

### CA2

**Marca:** teste de unidade

**Cenário:** Dado o parâmetro `mensagem` e a Última leitura guardada ao abrir, quando a Conversa
decide para onde ir, então a Mensagem pedida vence a primeira Não lida; sem ela, vale a primeira Não
lida da F07; sem as duas, a Conversa abre no fim. O divisor continua no lugar da F07.

**Teste previsto:** Vitest, `src/app/utils/jump-to-message.test.ts`, "a Mensagem pedida vence a
primeira Não lida"; Playwright, o do CA6, que prova o divisor.

### CA3

**Marca:** teste no Playwright

**Cenário:** Dada a Conversa aberta por `?mensagem=`, quando a ida termina, então a URL fica sem o
parâmetro, e recarregar a página não rola até a Mensagem de novo (abre no fim).

**Teste previsto:** Playwright, `e2e/atividade/abrir-na-mensagem.spec.ts`, "a URL perde o
parâmetro e recarregar não vai de novo".

### CA4

**Marca:** teste no Playwright

**Cenário:** Dada uma Mensagem apagada, quando a Pessoa abre a Conversa por `?mensagem=` dela,
então vê o aviso "A mensagem não está mais disponível", como a Citação da F06 que não aparece.

**Teste previsto:** Playwright, `e2e/atividade/abrir-na-mensagem.spec.ts`, "a Mensagem apagada
mostra que não está mais disponível".

### CA5

**Marca:** teste no Playwright

**Cenário:** Dada uma Menção não lida, quando a Pessoa abre a Conversa por `?mensagem=` com a aba
em foco, então a Conversa fica lida: a barra lateral perde o negrito e o contador.

**Teste previsto:** Playwright, `e2e/atividade/abrir-na-mensagem.spec.ts`, "abrir na Mensagem lê
a Conversa".

### CA6

**Marca:** teste no Playwright

**Cenário:** Dado um Canal com Não lidas a partir da Mensagem 21 de 160, quando a Pessoa abre por
`?mensagem=` da Mensagem 10, então a lista vai até a Mensagem 10, com o destaque, e o divisor
"Novas mensagens" fica acima da Mensagem 21. Também pela Atividade: Enter num item leva à Mensagem
dele, destacada.

**Teste previsto:** Playwright, `e2e/atividade/abrir-na-mensagem.spec.ts`, "a Mensagem pedida
vence a primeira Não lida, com o divisor no lugar" e "o item de Atividade leva à Mensagem".

## Contrato

O contrato não muda: o parâmetro `mensagem` da rota da Conversa já está na spec ("Abrir a Conversa
na Mensagem").

## Verificação do contrato

Nenhum item.

## Decisões

- O histórico lê `mensagem` com `useSearchParams`, no cliente, e não pela página do servidor: uma
  troca do parâmetro na mesma Conversa (um Alerta da mesma Conversa, na T05) chega sem montar o
  histórico de novo, e a ida usa o mesmo caminho de "ir até a Mensagem citada" da F06.
- O alvo inicial sai de uma função pura: a Mensagem pedida, se o parâmetro é um uuid; senão, a
  primeira Não lida (F07); senão, nenhum. O divisor da F07 não depende do alvo e fica onde está.
- Ao terminar a ida (achou, não achou ou falhou), o cliente tira o parâmetro com
  `window.history.replaceState`, que o roteador do Next acompanha, sem renderizar a página de novo
  no servidor.
- Um `mensagem` novo com a Conversa já aberta inicia outra ida, como uma Citação nova.

## Arquivos e interfaces

- `apps/web/src/app/utils/jump-to-message.ts`: `openingTarget(messageParam, dividerAfter)`.
- `apps/web/src/app/components/conversation/message-history.tsx`: o alvo inicial e a reação a um
  `mensagem` novo; a URL sem o parâmetro ao fim da ida.
- `apps/web/e2e/atividade/abrir-na-mensagem.spec.ts` e o plano de testes da F08.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum.
