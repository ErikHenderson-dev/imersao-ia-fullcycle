import { OpenProfileButton } from "@/app/components/profile/open-profile-button";
import type { Mention } from "@/app/services/chat-api";
import { cn } from "@/app/utils/cn";

type MentionChipProps = {
  mention: Mention;
  // O texto como foi escrito ("@ana").
  text: string;
  isSelf: boolean;
};

// Menção no texto da Mensagem (MentionChip; spec da F06, "Texto da Mensagem"): amarela para a própria
// pessoa e azul para os outros. Abre o Perfil da Pessoa mencionada.
export function MentionChip({ mention, text, isSelf }: MentionChipProps) {
  return (
    <OpenProfileButton
      personId={mention.id}
      className={cn(
        "rounded-item px-0.5 font-bold hover:underline",
        isSelf ? "bg-mention-self-bg text-mention-self-fg" : "bg-mention-bg text-mention-fg",
      )}
    >
      {text}
    </OpenProfileButton>
  );
}
