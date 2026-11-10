import { OpenProfileButton } from "@/app/components/profile/open-profile-button";
import {
  PersonAvatar,
  PersonName,
  PersonPresenceDot,
} from "@/app/components/people/person-display";
import { UserStatus } from "@/app/components/people/user-status";
import { OpenNavigationButton } from "@/app/components/workspace-nav/navigation-drawer";
import type { Conversation } from "@/app/services/chat-api";
import { ChannelIcon } from "./channel-icon";

type ConversationHeaderProps = {
  conversation: Pick<Conversation, "kind" | "name" | "topic" | "counterpart">;
  // O botão de Membros, que a página põe quando tem a Conversa inteira.
  members?: React.ReactNode;
};

// Cabeçalho da Conversa (ConversationHeader): h-header; o Tópico some abaixo de 640 px, e o botão
// da gaveta (Menu) só aparece abaixo de 768 px. Na Conversa direta, o avatar e o nome da outra
// Pessoa, que abrem o Perfil dela, sem Tópico nem Membros ("Conversa / Estrutura / Conversa
// direta").
export function ConversationHeader({ conversation, members }: ConversationHeaderProps) {
  const { name, topic, kind, counterpart } = conversation;
  if (kind === "direct" && counterpart) {
    return (
      <header className="flex h-header shrink-0 items-center gap-2 border-b border-border bg-surface pr-5 pl-2 md:pl-5">
        <OpenNavigationButton />
        <h1 className="flex min-w-0 items-center text-title font-black text-fg">
          <OpenProfileButton
            personId={counterpart.id}
            className="flex min-w-0 items-center gap-2 hover:underline"
          >
            <PersonAvatar person={counterpart} size="sm" />
            <span className="truncate">
              <PersonName id={counterpart.id} name={counterpart.name} />
            </span>
          </OpenProfileButton>
          <PersonPresenceDot personId={counterpart.id} className="ml-2" />
          <UserStatus personId={counterpart.id} className="ml-2 text-body" />
        </h1>
      </header>
    );
  }
  return (
    <header className="flex h-header shrink-0 items-center gap-2 border-b border-border bg-surface pr-5 pl-2 md:pl-5">
      <OpenNavigationButton />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <h1 className="flex shrink-0 items-center gap-1 text-title font-black text-fg">
          <ChannelIcon kind={kind} size={16} />
          {name}
        </h1>
        {topic && (
          <p className="hidden min-w-0 flex-1 truncate text-small text-fg-muted sm:block">
            {topic}
          </p>
        )}
      </div>
      {members}
    </header>
  );
}
