---
status: aceita
---

# 0028 · Bots numa tabela própria no Banco do chat

Cada Agente tem um bot no Banco do chat ([ADR 0008](0008-agentes-como-modulos.md)), que reserva o
`@usuário` dele desde a F10 e será o autor das Mensagens dele a partir da F11. Os bots ficam na
tabela `bots`, separada de `people`, e o comando de contas, único lugar que cria `@usuário`, confere
que nenhum `@usuário` está nas duas tabelas. Assim, o login, a busca, os Membros, a Presença e as
Notificações continuam lendo só Pessoas, sem filtro de tipo em cada consulta.

Descartadas: bots em `people`, com uma coluna de tipo, que daria a unicidade do `@usuário` e o
autor de Mensagem sem mudança, mas obrigaria toda consulta de Pessoa a excluir os bots e deixaria
uma conta sem senha na tabela do login; adiar o bot para a F11, que deixaria a reserva do
`@usuário` sem dono na F10.

Custo aceito: a unicidade do `@usuário` entre Pessoas e bots é conferida pelo comando de contas, e
não por uma restrição do banco. A F11 precisa tornar o autor de Mensagem polimórfico
(`messages.author_id` hoje é obrigatório e aponta para `people`), com efeito no payload do autor,
no histórico e nos eventos.
