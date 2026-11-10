"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/app/utils/cn";

type SidebarSectionProps = {
  title: string;
  // As linhas da seção, pelo estado dela: recolhida, quem a usa mostra só o que continua visível,
  // como as Conversas Não lidas (spec da F07, "Lista de Conversas e barra lateral").
  children: (isExpanded: boolean) => React.ReactNode;
};

// Seção da barra lateral: o título é um botão que recolhe e expande a lista (25:20813). O estado
// não é guardado: cada abertura do app começa com as seções expandidas.
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const listId = useId();
  return (
    <section aria-label={title} className="flex flex-col px-2 pb-4">
      <h2>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={listId}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="flex h-7 w-full items-center gap-2 rounded-item px-2 text-small font-bold text-sidebar-fg hover:bg-sidebar-hover"
        >
          <ChevronDown
            size={16}
            aria-hidden
            className={cn("transition-transform duration-100", !isExpanded && "-rotate-90")}
          />
          {title}
        </button>
      </h2>
      <ul id={listId} className="flex flex-col gap-px pt-1 empty:hidden">
        {children(isExpanded)}
      </ul>
    </section>
  );
}
