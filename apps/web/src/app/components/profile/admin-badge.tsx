import { ShieldCheck } from "lucide-react";

// Selo "Administrador" do painel de perfil, abaixo do @usuário (frame "Painel de perfil / Selo de
// administrador", 26:45404). O escudo é decorativo: o texto visível é o que o leitor de tela lê.
export function AdminBadge() {
  return (
    <p className="inline-flex w-fit items-center gap-1 rounded-control border border-border-subtle bg-surface-inset px-2 py-0.5 text-small text-fg-muted">
      <ShieldCheck size={12} aria-hidden />
      Administrador
    </p>
  );
}
