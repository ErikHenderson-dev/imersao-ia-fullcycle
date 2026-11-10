# Plano de testes da F09 · Perfil e tema

Os cenários do Playwright da F09, por tarefa, escritos pelo fluxo da skill `playwright-cli`. As
Pessoas, os Canais e as Mensagens são criados direto no banco (`support/database.ts`).

## F09-T01 · Editar o próprio Perfil (`perfil/editar-perfil.spec.ts`)

1. **Abre pelo menu do avatar, preenchido, e o Esc devolve o foco ao avatar:** pelo teclado, Enter
   no avatar e em "Editar perfil"; os campos vêm com o nome, o cargo e o telefone, com o foco em
   "Nome completo"; Esc fecha sem salvar.
2. **Salva pelo teclado, e o nome novo aparece no menu e no painel:** pelo botão "Editar perfil" do
   próprio painel, troca o nome e o cargo e salva com Enter; o foco volta ao botão.
3. **O nome vazio mostra o erro embaixo do campo e mantém o diálogo:** "Informe seu nome
   completo.", com o foco no campo e o cargo digitado mantido.
4. **A falha da API mostra o erro geral, com Salvando enquanto espera:** a Server Action presa e
   depois abortada.
5. **Outra Pessoa vê o nome novo numa Mensagem antiga ao recarregar.**
6. **O painel de outra Pessoa não tem Editar perfil.**

Acessibilidade (`acessibilidade/editar-perfil-sem-violacoes.spec.ts`): o diálogo com o erro de
campo, nos dois temas, sem violações do axe.

## F09-T02 · Perfil em tempo real (`perfil/perfil-em-tempo-real.spec.ts`)

1. **O nome novo aparece sem recarregar:** o Bruno, com uma Mensagem antiga da Ana, a Conversa
   direta com ela na barra lateral e o perfil dela aberto, vê o nome que a Ana salvou na Mensagem, na
   barra lateral, no painel, nos Membros do Canal e no cabeçalho da Conversa direta.
2. **As outras abas de quem editou mudam o Rail e o menu do avatar:** uma segunda aba da mesma
   Sessão passa a "Menu de Ana Lima".

## F09-T03 · Status (`perfil/status.spec.ts`)

1. **Escolhe e limpa o Status pelo teclado:** as setas mudam o emoji marcado; a mensagem acima de
   100 mostra o erro embaixo dela; salvar grava; espaço no marcado o desmarca, e salvar com a
   mensagem vazia limpa o Status.
2. **O Status chega sem recarregar, aparece onde o nome aparece e sai ao limpar:** o Bruno vê o
   emoji da Ana na Mensagem, na barra lateral, no painel de perfil (com a mensagem), no Tooltip,
   nos Membros e no cabeçalho da Conversa direta; quando ela limpa, o emoji some.

Acessibilidade (`acessibilidade/status-sem-violacoes.spec.ts`): o diálogo com um emoji marcado e
a mensagem, e o próprio perfil com o Status, nos dois temas, sem violações do axe.

## F09-T04 · Presença (`perfil/presenca.spec.ts`)

1. **Define como ausente e disponível pelo menu:** o cabeçalho mostra "Disponível" e o item
   "Definir como ausente"; depois, "Ausente" e "Definir como disponível"; a escolha vale ao
   recarregar.
2. **A falha volta à presença anterior:** a Server Action responde 500; o toast "Não foi possível
   mudar a presença" aparece e o menu volta a "Disponível".
3. **A outra Pessoa vê a Presença mudar sem recarregar:** no painel de perfil e no cabeçalho da
   Conversa direta.
4. **Fechar todas as abas deixa ausente depois da carência:** com a carência real (30 s).

Acessibilidade (`acessibilidade/presenca-sem-violacoes.spec.ts`): o menu do avatar aberto, nos dois
temas, sem violações do axe.
