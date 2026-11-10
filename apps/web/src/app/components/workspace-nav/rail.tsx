import { UserMenu } from "@/app/components/user/user-menu";
import { ThemeToggle } from "./theme-toggle";
import type { Person } from "@/app/services/chat-api";
import { Suspense } from "react";
import { ActivityLink } from "./activity-link";
import { ActivityNav } from "./activity-nav";
import { HomeLink } from "./home-link";

type RailProps = { person: Person };

// Trilho de seções, fundo chrome: o "FC", "Início", "Atividade" (F08) e o avatar de iniciais.
export function Rail({ person }: RailProps) {
  return (
    <nav
      aria-label="Seções"
      className="flex w-rail shrink-0 flex-col items-center gap-2 bg-chrome px-2 py-3"
    >
      <div className="pb-2">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-card bg-sidebar-fg-strong text-small font-black text-sidebar"
        >
          FC
        </span>
      </div>
      <HomeLink personId={person.id} />
      <Suspense fallback={<ActivityLink personId={person.id} initialUnread={null} />}>
        <ActivityNav personId={person.id} />
      </Suspense>
      <div className="flex-1" />
      <ThemeToggle personTheme={person.theme} />
      <UserMenu person={person} />
    </nav>
  );
}
