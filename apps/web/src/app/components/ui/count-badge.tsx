import { cn } from "@/app/utils/cn";
import { formatCount } from "@/app/utils/unread";

type CountBadgeProps = {
  count: number;
  className?: string;
};

// Contador (CountBadge): pílula vermelha com o número em branco, `99+` acima de 99, e nada em zero
// (design system, "Componentes"). Escondido do leitor de tela: quem o usa põe o número no próprio
// rótulo, para ele não ser lido duas vezes.
export function CountBadge({ count, className }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-pill bg-badge px-1 text-micro font-black text-on-badge",
        className,
      )}
    >
      {formatCount(count)}
    </span>
  );
}
