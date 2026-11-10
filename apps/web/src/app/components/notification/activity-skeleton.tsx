// As linhas de "Notificações carregando": avatar e duas linhas, em pulso.
export function ActivitySkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul aria-hidden className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-start gap-3 border-b border-border-subtle px-5 py-3">
          <span className="size-9 shrink-0 animate-pulse rounded-item bg-surface-inset" />
          <span className="flex flex-1 flex-col gap-2 pt-1">
            <span className="h-3 w-56 animate-pulse rounded-control bg-surface-inset" />
            <span className="h-3 w-full max-w-208 animate-pulse rounded-control bg-surface-inset" />
          </span>
        </li>
      ))}
    </ul>
  );
}
