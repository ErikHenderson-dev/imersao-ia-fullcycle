import type { BotReadPage } from '../messages/messages.service';

export interface BotMessagesResponse {
  messages: {
    id: string;
    author: { name: string; username: string };
    body: string;
    created_at: string;
  }[];
  total: number;
}

export function toBotMessagesResponse(page: BotReadPage): BotMessagesResponse {
  return {
    messages: page.messages.map((message) => ({
      id: message.id,
      author: message.author,
      body: message.body,
      created_at: message.createdAt.toISOString(),
    })),
    total: page.total,
  };
}
