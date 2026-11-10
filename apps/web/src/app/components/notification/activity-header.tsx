// O cabeçalho da tela Atividade, com o "Marcar tudo como lido" à direita quando a tela já sabe a
// Pessoa (no carregando, ele não aparece).
export function ActivityHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="flex h-header shrink-0 items-center gap-2 border-b border-border bg-surface px-5">
      <h1 className="flex-1 text-title font-black text-fg">Atividade</h1>
      {action}
    </header>
  );
}
