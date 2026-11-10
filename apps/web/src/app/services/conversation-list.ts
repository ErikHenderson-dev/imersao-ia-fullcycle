import type { Conversation } from "@/app/services/chat-api";
import { CONVERSATIONS_URL } from "@/app/utils/conversation-list";

// A lista de Conversas pela rota do BFF, no cliente: a função de busca de todo hook do SWR na chave
// da lista. Uma revalidação da chave (o reset do tempo real) roda a busca do primeiro hook que se
// registrou nela, e por isso nenhum deles pode ficar sem ela.
// Um 401 aqui é só uma falha: a lista que está na tela fica, e quem leva a "Entrar" é o fim da
// Sessão no tempo real (session.ended) ou a próxima ação da Pessoa. Sem isso, a busca do reset da
// primeira conexão disputaria a navegação com quem acabou de sair.
export async function fetchConversationList(): Promise<readonly Conversation[]> {
  const response = await fetch(CONVERSATIONS_URL);
  if (!response.ok) throw new Error("Não foi possível carregar as conversas.");
  return (await response.json()) as Conversation[];
}
