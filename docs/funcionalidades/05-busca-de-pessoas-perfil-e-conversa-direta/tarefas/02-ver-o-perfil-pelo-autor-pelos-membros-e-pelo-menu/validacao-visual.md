# Validação visual da F05-T02

Capturas da web em 1440 × 900, no Chromium do contêiner `e2e`, ao lado das capturas dos frames da
seção "Painel de perfil" do Figma (arquivo `slack`, página Telas, no modo Dark da coleção
Semantic): Carregando (26:41815), Outra pessoa (26:43588), Próprio perfil (26:44497), Pessoa não
encontrada (26:42679), Erro ao carregar (26:47242, na seção "Erros corretos") e Sem cargo, telefone
e hora local (123:34952, criado nesta tarefa). O tema escuro da web é o `data-theme="dark"` na raiz.

Os dados da web vêm de um teste: Regina Fonseca, com cargo e telefone, e Bruno Lima, sem eles, com
uma Mensagem cada num Canal de teste. O Carregando foi capturado com a leitura do Perfil presa pelo
`page.route`; Pessoa não encontrada e Erro ao carregar, com a leitura respondida com 404 e 502.

| Estado | Web, claro | Web, escuro | Figma, escuro |
| --- | --- | --- | --- |
| Carregando | ![](capturas/carregando-claro.png) | ![](capturas/carregando-escuro.png) | ![](capturas/figma-carregando-escuro.png) |
| Outra pessoa | ![](capturas/outra-pessoa-claro.png) | ![](capturas/outra-pessoa-escuro.png) | ![](capturas/figma-outra-pessoa-escuro.png) |
| Sem cargo e telefone | ![](capturas/sem-cargo-telefone-claro.png) | ![](capturas/sem-cargo-telefone-escuro.png) | ![](capturas/figma-sem-cargo-telefone-escuro.png) |
| Próprio perfil | ![](capturas/proprio-perfil-claro.png) | ![](capturas/proprio-perfil-escuro.png) | ![](capturas/figma-proprio-perfil-escuro.png) |
| Pessoa não encontrada | ![](capturas/pessoa-nao-encontrada-claro.png) | ![](capturas/pessoa-nao-encontrada-escuro.png) | ![](capturas/figma-pessoa-nao-encontrada-escuro.png) |
| Erro ao carregar | ![](capturas/erro-ao-carregar-claro.png) | ![](capturas/erro-ao-carregar-escuro.png) | ![](capturas/figma-erro-ao-carregar-escuro.png) |

## O que bate

- O painel com `w-panel` (384), a borda à esquerda e o cabeçalho de `h-header` com "Perfil" em
  `title/black` e o X de 36 px.
- O avatar `xl` de 96 px com `rounded-panel` e as iniciais em `display/black`; o nome em
  `heading/black`, o cargo em `body`, o `@usuário` em `small` e `fg-muted`.
- "Mensagem" como Button secondary com o ícone `message-square`; "Informações de contato" em
  `body/black`, com a borda `border-subtle` acima, e cada ContactRow com o quadro de 36 px em
  `surface-inset`, o rótulo em `small`/`fg-muted` e o valor em `link`.
- O Carregando com os três Skeletons (96, 192 × 24 e 128 × 16); o Pessoa não encontrada e o Erro
  ao carregar com o EmptyState e o texto dos frames, este com "Tentar de novo" (primary).

## Diferenças esperadas

- Presença, status, selo de administrador, hora local (F05-T03) e "Editar perfil" (F09) não
  aparecem na web, como diz o PRD em "O que não é objetivo".
- "Mensagem" está desabilitado (`opacity-50`) até a F05-T04 criar a Conversa direta.
- As cores dos avatares vêm do id de cada Pessoa, e o nome do autor sublinha ao passar o mouse: na
  captura, o ponteiro ficou sobre ele depois do clique.
- O e-mail de teste é longo e quebra em duas linhas; no Figma o e-mail é curto.
