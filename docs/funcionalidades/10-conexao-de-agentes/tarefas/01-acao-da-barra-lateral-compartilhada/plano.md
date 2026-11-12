# Plano da F10-T01: Ação da barra lateral compartilhada

Tarefa: [tarefa.md](tarefa.md) · Spec: [spec.md](../../spec.md) · PRD: [prd.md](../../prd.md)

## Critérios

### CA1

**Marca:** revisão humana

**Cenário:** Quem revisa abre `src/app/components/workspace-nav/sidebar-action.tsx` e o component
set SidebarAction do Figma (16:653) e encontra os seis modos do Figma (`add-channel`, `new-dm`,
`connect`, `add`, `manage` e `view`), cada um com o rótulo, o ícone do Lucide (`plus`, `plug`,
`settings-2`, `bot`) e o tamanho do quadro do ícone (16 px em `add-channel`, 20 px nos outros) do
desenho, o rótulo de `connect` em `font-black` e `sidebar-fg-strong`, e o CountBadge opcional no
fim, com o número também num texto só para o leitor de tela. O componente é um `<button>` nativo,
alcançável pelo Tab e acionado por Enter e espaço, que aceita ser o `asChild` de um
`DialogTrigger`.

### CA2

**Marca:** documento

**Cenário:** Quem revisa abre `validacao-visual.md`, nesta pasta, e encontra "Adicionar canal" e
"Nova conversa" na barra lateral, nos dois temas e na gaveta abaixo de 768 px, ao lado do frame
"Casca / Sidebar / Com dados" e do SidebarAction do Figma, com as mesmas medidas, cores e rótulos
de antes da refatoração.

### CA3

**Marca:** teste no Playwright

**Cenário:** Dada a barra lateral com o `SidebarAction`, quando a suíte roda os testes que já
abrem "Adicionar canal" e "Nova conversa" pelo teclado e pelo clique, então todos passam sem
nenhuma mudança nos arquivos de teste.

**Teste previsto:** Playwright, sem arquivo novo: `e2e/canais-publicos/criar-canal-publico.spec.ts`,
`e2e/conversa-direta/nova-conversa.spec.ts`, `e2e/conversa/abrir-canal-pela-barra-lateral.spec.ts`,
`e2e/acessibilidade/nova-conversa-sem-violacoes.spec.ts`,
`e2e/canais-publicos/criar-canal-sem-violacoes.spec.ts` e os de `e2e/canais-privados/` que abrem o
diálogo pela barra lateral.

## Contrato

O contrato não muda.

## Verificação do contrato

Nenhum item.

## Decisões

- **Variante pelo `Mode` do Figma.** A prop `variant` tem os seis valores do `Mode` do component
  set (`add-channel`, `new-dm`, `connect`, `add`, `manage`, `view`), e não só os quatro da seção
  Agentes: "Adicionar canal" e "Nova conversa" são modos do mesmo component set, com o quadro de
  tamanho próprio, e um componente do Figma corresponde a um no código (design system,
  "Organização no código").
- **Rótulo e ícone saem da variante.** Um mapa `SIDEBAR_ACTIONS` dá, por variante, o rótulo, o
  ícone e o tamanho do quadro, como no Figma, e quem usa não os repete. Os textos são fixos no
  desenho, e um rótulo livre deixaria duas fontes para a mesma frase.
- **Contador opcional, com texto acessível.** A prop `count` mostra o CountBadge no fim da linha, e
  `countLabel` diz ao leitor de tela o que o número conta ("2 desconectados"), num `sr-only`
  dentro do botão, porque o CountBadge é `aria-hidden`. A 06 é quem passa os dois em `connect`.
- **Ação pelas props nativas.** O componente é um `<button type="button">` que repassa as props e
  a `ref` (React 19, `ref` como prop), para servir de `DialogTrigger asChild` e receber `onClick`.
  Ele não embrulha o `<li>`: quem usa monta a linha da lista, como hoje.
- **Medidas atuais preservadas.** A linha continua `h-11` abaixo de `md` e `h-7` acima, com o
  quadro `bg-sidebar-field` e o ícone de 12 px, como as duas ações de hoje.

## Arquivos e interfaces

- `src/app/components/workspace-nav/sidebar-action.tsx`: novo, `SidebarAction({ variant, count?,
  countLabel?, ...buttonProps })` e o tipo `SidebarActionVariant`.
- `src/app/components/workspace-nav/add-channel-action.tsx`: o botão do `DialogTrigger` vira
  `<SidebarAction variant="add-channel" />`.
- `src/app/components/workspace-nav/new-conversation-action.tsx`: o botão vira
  `<SidebarAction variant="new-dm" />`.
- Figma, SidebarAction (16:653): a descrição ganha o caminho do arquivo no código.

## Testes existentes que mudam

Nenhum.

## Mudança de dados

Nenhuma.

## Documentos atualizados

Nenhum. O design system já registra o SidebarAction e as variantes da seção Agentes
("Comportamentos registrados no Figma").
