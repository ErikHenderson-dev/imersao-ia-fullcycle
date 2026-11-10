# Plano de testes da F07 · Não lidas e menções

Escrito pelo fluxo da skill `playwright-cli` (planejar, gerar e corrigir), no contêiner `e2e`.
O que é coberto é da spec da F07 ([spec.md](../../../docs/funcionalidades/07-nao-lidas-e-mencoes/spec.md),
"Decisões de teste"); este plano é dono dos passos de cada cenário. As Pessoas, as Conversas, as
Mensagens e as Menções são criadas direto no banco.

## Cenários

### 1. Números na barra lateral (F07-T01)

**Seed:** `e2e/seed.spec.ts` · **File:** `e2e/nao-lidas/barra-lateral.spec.ts`

Duas Pessoas, dois Canais e uma Conversa direta, com Mensagens da outra Pessoa ainda não lidas.

1. **mostra a Menção no Canal e as Não lidas na Conversa direta:** ao entrar, o Canal com uma
   Menção aparece em negrito com o contador 1 e o rótulo "<canal>, não lidas, 1 menção"; o Canal
   sem Menção, em negrito e sem contador; a Conversa direta com duas Não lidas, em negrito com o
   contador 2 e o rótulo "<nome>, 2 mensagens não lidas".
2. **a seção recolhida mostra só as Conversas Não lidas:** recolher "Canais" deixa visível só o
   Canal com Não lidas.

**File:** `e2e/acessibilidade/nao-lidas-sem-violacoes.spec.ts`

3. **a barra lateral com Não lidas não tem violações de acessibilidade:** o axe, com um Canal e
   uma Conversa direta Não lidos, sem violações.
