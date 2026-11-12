# 03: Banco de negócio com dados fixos

**Status:** concluída

**O que construir:** quem desenvolve carrega o Banco de negócio com um comando e sempre obtém os
mesmos dados de vendas (clientes, vendedores, produtos, pedidos e itens), que servem ao
desenvolvimento, aos testes de integração e ao gabarito da avaliação. O Serviço de agentes passa a
ter a conexão só leitura com esse banco. Referências:
- spec da F13, "Banco de negócio e script de carga" e "Ambiente de desenvolvimento";
- [ADR 0013](../../../../adr/0013-somente-leitura-banco-e-codigo.md);
- LLD, "Ambiente de desenvolvimento".

**Bloqueada por:** Nenhuma (pode começar imediatamente)

- [x] **CA1** · O script de carga, rodado com `uv run` no contêiner `agents` com a URL do usuário
  dono, cria as tabelas `customers`, `sellers`, `products`, `orders` e `order_items` com as colunas
  e os índices da spec, numa transação.
- [x] **CA2** · O script é idempotente e determinístico: rodar duas vezes dá os mesmos dados, com
  pedidos de 01/01/2025 a 31/10/2026 no fuso da empresa e status `paid`, `cancelled` e `pending`.
- [x] **CA3** · Os dados trazem dois vendedores com "Ana", mais de cinco clientes com "Silva" e um
  vendedor sem pedidos num mês conhecido.
- [x] **CA4** · O `compose.yaml` dá ao `agents` `BUSINESS_DATABASE_URL` (usuário
  `business_readonly`), `BUSINESS_OWNER_DATABASE_URL` e `BUSINESS_TEST_DATABASE_URL`, e o
  `config.py` as valida.
- [x] **CA5** · Um teste de integração carrega o banco de teste e confere que o usuário só leitura
  lê as tabelas e não consegue escrever nelas.
- [x] **CA6** · O passo a passo do `AGENTS.md` raiz ganha a carga do Banco de negócio depois das
  migrações, e o LLD é atualizado pela skill `lld` nas seções que esta tarefa toca.
