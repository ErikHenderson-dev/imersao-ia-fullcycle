import { toast } from "sonner";

// Copia o texto de uma Mensagem como está gravado, sem autor nem hora (PRD da F06, história 4), e
// avisa o resultado num toast.
export async function copyMessageText(body: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(body);
    toast.success("Texto copiado");
  } catch {
    toast.error("Não foi possível copiar o texto");
  }
}
