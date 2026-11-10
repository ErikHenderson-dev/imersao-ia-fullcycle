// O cabeçalho da tela Atividade. O "Marcar tudo como lido" entra na F08-T04.
export function ActivityHeader() {
  return (
    <header className="flex h-header shrink-0 items-center gap-2 border-b border-border bg-surface px-5">
      <h1 className="flex-1 text-title font-black text-fg">Atividade</h1>
    </header>
  );
}
