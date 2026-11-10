# Plano de testes da F06 · Ações na mensagem

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F06 ([spec.md](../../../docs/funcionalidades/06-acoes-na-mensagem/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário. As Pessoas, os Canais e as
Mensagens são criados direto no banco.

## Cenários

### 1. Barra de ações, menu e copiar o texto (F06-T02)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/conversa/acoes-na-mensagem.spec.ts`

Uma Mensagem da Pessoa logada, com uma quebra de linha e um link, e as permissões
`clipboard-read` e `clipboard-write` concedidas ao contexto.

1. **mostra a barra no hover e no foco:** a barra começa com opacidade zero; o mouse sobre a
   Mensagem a mostra; "Mais ações" abre o menu com "Copiar texto"; sem hover e sem foco ela some, e
   o foco em "Copiar texto" a mostra de novo.
2. **mostra a dica dos botões da barra:** o mouse sobre "Copiar texto" mostra a dica com o rótulo.
3. **copia o texto de uma Mensagem pela barra e pelo menu:** a área de transferência fica com o
   texto gravado, sem autor nem hora, e aparece "Texto copiado", que fecha pelo botão de fechar.
4. **mostra o erro quando o navegador recusa a cópia:** com `navigator.clipboard.writeText`
   rejeitando, aparece "Não foi possível copiar o texto".
5. **usa a barra e o menu só pelo teclado:** do link da Mensagem, Tab chega a "Copiar texto" e a
   "Mais ações"; Enter abre o menu com o foco no item; Esc fecha e devolve o foco; Espaço abre e
   Enter no item copia.
6. **a Mensagem com falha no envio não tem barra:** com o envio abortado, a Mensagem com falha
   não tem "Copiar texto" nem "Mais ações".

**File:** `e2e/acessibilidade/acoes-na-mensagem-sem-violacoes.spec.ts`

7. **a barra e o menu não têm violações de acessibilidade:** o axe sem violações com a barra à
   vista e com o menu aberto.
