# 06: Remover Membro de Canal privado pelo comando

**Status:** concluída

**O que construir:** quem opera a instalação remove de um Canal privado uma Pessoa adicionada por
engano, pelo comando de canais, até a F17 trazer a remoção pelo produto. A Pessoa para de receber
as Mensagens do Canal na hora e deixa de vê-lo na barra lateral ao recarregar a página. Referências:
- spec da F04, "Comando de canais" e história 7;
- spec da F02, "Comando de canais";
- PRD, seção 4, "Riscos de produto".

**Decisões consumidas de outras tarefas:**
- Tipo `private_channel`: 02.

**Bloqueada por:** 02 (Canal privado visível só para quem o criou)

- [x] **CA1** · A operação `remove-member` do comando de canais recebe o nome do Canal privado e o
  e-mail da Pessoa e apaga a participação, sem publicar evento.
- [x] **CA2** · Canal inexistente, Canal público, e-mail sem conta e Pessoa que não é Membro são
  recusados com mensagem, sem mudar nada.
- [x] **CA3** · O teste de integração contra o banco de testes prova a remoção e as quatro recusas,
  e que a Pessoa removida passa a receber 404 no Canal.
- [x] **CA4** · A operação entra no `AGENTS.md` da API, seção "Comandos".
