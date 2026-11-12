import type { Page } from "@playwright/test";

// A API do chat, que o navegador do teste alcança em localhost:3001 com o mesmo cookie de sessão
// (AGENTS.md, "Testes de ponta a ponta"). Para o teste mudar uma Mensagem como outra Pessoa, sem
// passar pela tela dela.
export const API = "http://localhost:3001/v1";

// Envia uma Mensagem como a Pessoa logada na página, com os campos do envio além do `client_id`, e
// devolve o corpo da resposta.
export async function postMessageByApi<T>(
  page: Page,
  conversationId: string,
  data: { body: string; agent_username?: string },
): Promise<T> {
  const response = await page.request.post(`${API}/conversations/${conversationId}/messages`, {
    data: { client_id: crypto.randomUUID(), ...data },
  });
  if (!response.ok()) throw new Error(`Envio recusado: ${response.status()}`);
  return (await response.json()) as T;
}

// Envia uma Mensagem como a Pessoa logada na página e devolve o id dela.
export async function sendByApi(page: Page, conversationId: string, body: string): Promise<string> {
  const { message } = await postMessageByApi<{ message: { id: string } }>(page, conversationId, { body });
  return message.id;
}

// Apaga a própria Mensagem como a Pessoa logada na página.
export async function deleteByApi(page: Page, conversationId: string, messageId: string): Promise<void> {
  const response = await page.request.delete(`${API}/conversations/${conversationId}/messages/${messageId}`);
  if (!response.ok()) throw new Error(`Exclusão recusada: ${response.status()}`);
}
