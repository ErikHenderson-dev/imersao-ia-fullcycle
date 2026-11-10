import { EmptyState } from "@/app/components/ui/empty-state";
import { RetryButton } from "@/app/components/ui/retry-button";

// "Atividade / Erro": a lista não carregou; "Tentar de novo" renderiza a rota de novo.
export function ActivityError() {
  const title = "Não foi possível carregar sua atividade";
  return (
    <div className="flex justify-center">
      <EmptyState
        title={title}
        description="Verifique sua conexão e tente de novo."
        action={<RetryButton announce={title} />}
      />
    </div>
  );
}
