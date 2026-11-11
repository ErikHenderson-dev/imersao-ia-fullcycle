# Validação visual da F10-T06

Capturas da web em 1440 × 900, no Chromium do contêiner `e2e`, como administrador, ao lado dos
frames do Figma (arquivo `slack`, página Telas, modo Light; os frames de erro novos têm a cópia
escura no próprio Figma). O "Conectando" vem com a Server Action segurada no navegador, e o erro
com ela respondendo 500.

| Estado | Web, claro | Web, escuro | Figma |
| --- | --- | --- | --- |
| Seção, nenhum conectado | ![](capturas/secao-nenhum-conectado-claro.png) | ![](capturas/secao-nenhum-conectado-escuro.png) | ![](capturas/figma-casca-nenhum-conectado.png) (Casca / Agentes / Admin sem nenhum conectado) |
| Seção, todos conectados | ![](capturas/secao-todos-conectados-claro.png) | ![](capturas/secao-todos-conectados-escuro.png) | ![](capturas/figma-casca-todos-conectados.png) (Casca / Agentes / Admin com todos conectados) |
| Diálogo, Admin sem conectados | ![](capturas/dialogo-admin-sem-conectados-claro.png) | ![](capturas/dialogo-admin-sem-conectados-escuro.png) | ![](capturas/figma-dialogo-admin-sem-conectados.png) |
| Diálogo, Conectando | ![](capturas/dialogo-conectando-claro.png) | ![](capturas/dialogo-conectando-escuro.png) | ![](capturas/figma-dialogo-conectando.png) |
| Diálogo, Admin com conectado | ![](capturas/dialogo-admin-com-conectado-claro.png) | ![](capturas/dialogo-admin-com-conectado-escuro.png) | ![](capturas/figma-dialogo-admin-com-conectado.png) |
| Erro ao conectar | ![](capturas/tela-erro-ao-conectar-claro.png) | ![](capturas/tela-erro-ao-conectar-escuro.png) | ![](capturas/figma-erro-ao-conectar.png) (Diálogos / Agentes / Erro ao conectar) |

## O que bate

- "Conectar agentes" em `font-black` e `sidebar-fg-strong`, com o `plug` e o CountBadge do número
  de desconectados; "Gerenciar agentes" com o `settings-2` e a linha do Agente.
- A descrição de administrador, o aviso de "Admin sem conectados", "Conectar" (Button `primary`,
  `sm`) e "Desconectar" (Button `secondary`, `sm`).
- "Conectando": o botão a 50% de opacidade, com o spinner no lugar do ícone e o texto mantido.
- O erro no Toast de erro do Sonner, no canto inferior direito, com o diálogo aberto e o Agente
  ainda desconectado.

## Diferenças esperadas

- "Admin com parte conectada" (25:22334) não aparece com um catálogo de um Agente só; a variante
  `add` é provada pelo Vitest (CA4).
