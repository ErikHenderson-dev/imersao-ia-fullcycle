import { cva } from "class-variance-authority";
import { cn } from "@/app/utils/cn";

const COLORS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
] as const;

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center font-black text-on-primary",
  {
    variants: {
      size: {
        sm: "size-6 rounded-control text-micro",
        md: "size-9 rounded-item text-small",
        // O do painel de perfil (Figma, ProfilePanel).
        xl: "size-24 rounded-panel text-display",
      },
    },
    defaultVariants: { size: "md" },
  },
);

// A cor sai do id, para a mesma Pessoa ter sempre a mesma cor.
function colorFor(seed: string): string {
  let sum = 0;
  for (const char of seed) sum += char.charCodeAt(0);
  return COLORS[sum % COLORS.length];
}

type AvatarProps = {
  // Já calculadas no servidor (Person.initials, de services/chat-api.ts).
  initials: string;
  seed: string;
  size?: "sm" | "md" | "xl";
  className?: string;
};

export function Avatar({ initials, seed, size, className }: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size }), colorFor(seed), className)}
      aria-hidden
    >
      {initials}
    </span>
  );
}
