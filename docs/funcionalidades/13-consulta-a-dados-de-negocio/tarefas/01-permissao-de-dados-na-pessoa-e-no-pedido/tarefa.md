# 01: Permissão de dados na Pessoa e no Pedido

**Status:** concluída

**O que construir:** quem opera a instalação liga e desliga a Permissão de dados de uma Pessoa por
um comando de contas, como faz com o papel de Administrador. A Pessoa da Sessão passa a trazer a
permissão, e todo Pedido a um Agente leva a Permissão de dados de quem pediu ao Serviço de agentes,
que a guarda no estado do Pedido sem mostrá-la ao modelo. Referências:
- spec da F13, "Permissão de dados", "Citação enviada ao Agente" (o `requester.data_access`) e
  "Rota de Pedido e execução";
- [ADR 0015](../../../../adr/0015-permissoes-enviadas-pelo-bff.md);
- PRD, história 7.

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · A coluna `data_access` existe em `people`, falsa por padrão, numa migração nova.
- [x] **CA2** · `pnpm accounts set-data-access <e-mail|@usuário> on|off` liga e desliga a
  permissão, grava só se mudar e imprime "agora tem / deixou de ter / já tinha / já não tinha
  Permissão de dados"; o `USAGE` do comando mostra a linha nova.
- [x] **CA3** · A Pessoa da Sessão traz `data_access`; o Perfil visto pelos outros não a mostra.
- [x] **CA4** · O BFF envia `requester.data_access` no `POST /v1/requests`, lido da Pessoa da Sessão.
- [x] **CA5** · O Serviço de agentes aceita `requester.data_access`, falso quando ausente, e o
  guarda no estado do Pedido, fora das instruções do modelo.
- [x] **CA6** · Testes de ponta a ponta da API do chat cobrem o comando e a Pessoa da Sessão, e
  testes do Serviço de agentes cobrem o corpo com e sem o campo.
- [x] **CA7** · O passo a passo do `AGENTS.md` raiz ganha o `set-data-access` para a Pessoa de
  desenvolvimento, e o LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
