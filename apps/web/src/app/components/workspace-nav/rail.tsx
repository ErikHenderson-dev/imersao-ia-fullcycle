import { UserMenu } from "@/app/components/user/user-menu";
import type { Person } from "@/app/services/chat-api";
import { HomeLink } from "./home-link";

type RailProps = { person: Person };

// Trilho de seções, fundo chrome. Na F01: o "FC", "Início" e o avatar de iniciais.
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
      <div className="flex-1" />
      <UserMenu person={person} />
    </nav>
  );
}
