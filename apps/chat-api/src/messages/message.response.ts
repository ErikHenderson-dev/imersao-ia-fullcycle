import type {
  MessageAuthorPayload,
  QuickRepliesPayload,
  QuotePayload,
  ReportPayload,
} from 'chat-events';
import { MessageView, QuoteView } from './messages.service';

export interface MessageResponse {
  id: string;
  conversation_id: string;
  client_id: string;
  author: MessageAuthorPayload;
  body: string;
  created_at: string;
  edited_at: string | null;
  mentions: { id: string; username: string }[];
  quote: QuotePayload | null;
  quick_replies: QuickRepliesPayload | null;
  // A marca "dados de negócio" e a Resposta bloqueada (spec da F13, "Marca e Resposta bloqueada").
  business_data: boolean;
  blocked: boolean;
  // O PDF da entrega do Relatório, nulo na versão bloqueada (spec da F14).
  report: ReportPayload | null;
}

// Quem vai ler a Mensagem: a Permissão de dados dele decide o bloqueio (ADR 0020).
export interface MessageReader {
  dataAccess: boolean;
}

// O bot lê a própria resposta, completa, nas rotas do bot.
export const BOT_READER: MessageReader = { dataAccess: true };

// A função única que monta a Mensagem para quem vai lê-la (LLD, "Concorrência e idempotência",
// "Dados de negócio no tempo real"): o histórico, o envio, a edição, a Atividade, as rotas do bot e
// os eventos passam por ela. Uma Mensagem com a marca, para um leitor sem Permissão de dados, sai
// bloqueada, com o texto e as Respostas prontas vazios; a citação dela, também.
export function toMessageResponse(
  message: MessageView,
  reader: MessageReader,
): MessageResponse {
  const { quickReplies } = message;
  const blocked = isBlocked(message.businessData, reader);
  return {
    id: message.id,
    conversation_id: message.conversationId,
    client_id: message.clientId,
    author: message.author,
    body: blocked ? '' : message.body,
    created_at: message.createdAt.toISOString(),
    edited_at: message.editedAt?.toISOString() ?? null,
    mentions: message.mentions,
    quote: message.quote && toQuotePayload(message.quote, reader),
    quick_replies:
      blocked || !quickReplies
        ? null
        : {
            options: quickReplies.options,
            owner_id: quickReplies.ownerId,
            expires_at: quickReplies.expiresAt.toISOString(),
            closed: quickReplies.closed,
          },
    business_data: message.businessData,
    blocked,
    report:
      blocked || !message.report
        ? null
        : {
            file_name: message.report.fileName,
            size_bytes: message.report.sizeBytes,
          },
  };
}

// A Mensagem montada tem algo bloqueado: ela mesma ou a citada.
export function hasBlockedContent(message: MessageResponse): boolean {
  return (
    message.blocked ||
    (message.quote !== null &&
      !message.quote.deleted &&
      !!message.quote.blocked)
  );
}

function toQuotePayload(quote: QuoteView, reader: MessageReader): QuotePayload {
  if (quote.deleted) return quote;
  const blocked = isBlocked(quote.businessData, reader);
  return {
    id: quote.id,
    deleted: false,
    author: quote.author,
    body: blocked ? '' : quote.body,
    business_data: quote.businessData,
    blocked,
  };
}

function isBlocked(businessData: boolean, reader: MessageReader): boolean {
  return businessData && !reader.dataAccess;
}
