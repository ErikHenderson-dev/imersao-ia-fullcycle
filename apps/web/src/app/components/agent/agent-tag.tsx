import { cn } from "@/app/utils/cn";

// AgentTag: a marca "AGENTE" ao lado do nome do Agente numa Mensagem (design system, "MessageItem";
// spec da F11, "MessageItem de bot").
export function AgentTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 items-center rounded-control bg-surface-inset px-1 text-caption font-bold text-fg-muted",
        className,
      )}
    >
      AGENTE
    </span>
  );
}
