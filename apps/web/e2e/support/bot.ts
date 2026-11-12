import type { Page } from "@playwright/test";
import { API, postMessageByApi } from "./chat-api";

// Apoio para o teste agir como o bot de um Agente (spec da F11, "Decisões de teste"): o Pedido que o
// envio criou é lido do banco (`latestAgentRequestOf`, em database.ts), e o bot age pelas rotas
// /v1/bot da API do chat, com a credencial de bot, sem o modelo. Num teste sem o modelo, o bot do
// teste age antes do Serviço de agentes, e a ação dele depois é a repetição, sem nova Mensagem
// (bot_actions).

// Uma ação do bot; o corpo da resposta, ou null no 204. Com `token`, age com outra credencial, como
// a do Worker na falha do Relatório (F14-T01).
async function botPost<T>(
  requestId: string,
  action: string,
  payload?: unknown,
  token = process.env.CHAT_BOT_TOKEN,
): Promise<T | null> {
  const response = await fetch(`${API}/bot/requests/${requestId}/${action}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`A ação ${action} do bot foi recusada: ${response.status}`);
  return response.status === 204 ? null : ((await response.json()) as T);
}

// A resposta do bot ao Pedido; a repetição devolve a Mensagem já gravada. Com `businessData`, a
// resposta leva a marca "dados de negócio" (F13-T02).
export async function botReply(
  requestId: string,
  body: string,
  { businessData = false }: { businessData?: boolean } = {},
): Promise<{ id: string; body: string }> {
  const result = await botPost<{ message: { id: string; body: string } }>(requestId, "reply", {
    body,
    business_data: businessData,
  });
  return result!.message;
}

// O "digitando" do bot no Pedido (F11-T05).
export async function botTyping(requestId: string): Promise<void> {
  await botPost(requestId, "typing");
}

// Um Pedido para o bot, criado pela rota de envio da API do chat como a Pessoa logada na página, com o
// `agent_username` que o BFF preencheria. Sem passar pelo BFF, o Serviço de agentes não recebe o
// Pedido, e só o bot do teste age nele. Devolve o id do Pedido.
export async function requestByApi(page: Page, conversationId: string, agentUsername: string): Promise<string> {
  const { agent_request } = await postMessageByApi<{ agent_request: { id: string } }>(page, conversationId, {
    body: `@${agentUsername} resume hoje`,
    agent_username: agentUsername,
  });
  return agent_request.id;
}

// A pergunta do bot com as Respostas prontas, que abre a Pergunta pendente de quem pediu (F11-T07).
// Devolve o id da Mensagem da pergunta.
export async function botQuestion(requestId: string, body: string, quickReplies: string[]): Promise<string> {
  const result = await botPost<{ message: { id: string } }>(requestId, "question", {
    body,
    quick_replies: quickReplies,
  });
  return result!.message.id;
}

// A delegação pelo bot (F12-T01): cria a Tarefa e a confirmação. Devolve a Tarefa, no formato da API.
export async function botTask(
  requestId: string,
  assigneeUsername: string,
  title: string,
): Promise<{ id: string; trigger_message: { id: string } }> {
  const result = await botPost<{ task: { id: string; trigger_message: { id: string } } }>(requestId, "task", {
    assignee_username: assigneeUsername,
    title,
  });
  return result!.task;
}

// O Aviso de início do Relatório, com a marca "dados de negócio" (F14-T01). Devolve a Mensagem.
export async function botReportStarted(requestId: string, body: string): Promise<{ id: string; body: string }> {
  const result = await botPost<{ message: { id: string; body: string } }>(requestId, "report-started", { body });
  return result!.message;
}

// O "não consegui gerar o relatório", gravado pelo Worker com a credencial dele (F14-T01). Devolve a
// Mensagem, com a Menção a quem pediu.
export async function workerReportFailed(requestId: string): Promise<{ id: string; body: string }> {
  const result = await botPost<{ message: { id: string; body: string } }>(
    requestId,
    "report-failed",
    undefined,
    process.env.CHAT_WORKER_TOKEN,
  );
  return result!.message;
}

// A entrega do Relatório, gravada pelo Worker com a credencial dele (F14-T02), do PDF já gravado no
// S3 na chave do Pedido. Devolve a Mensagem.
export async function workerReportDelivered(
  requestId: string,
  report: { fileName: string; sizeBytes: number },
): Promise<{ id: string; body: string }> {
  const result = await botPost<{ message: { id: string; body: string } }>(
    requestId,
    "report-delivered",
    { storage_key: `reports/${requestId}.pdf`, file_name: report.fileName, size_bytes: report.sizeBytes },
    process.env.CHAT_WORKER_TOKEN,
  );
  return result!.message;
}
