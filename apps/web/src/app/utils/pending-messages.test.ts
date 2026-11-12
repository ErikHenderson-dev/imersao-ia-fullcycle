import { describe, expect, it } from "vitest";
import type { Message } from "@/app/services/chat-api";
import { withoutDelivered } from "./pending-messages";

function message(clientId: string, authorId = "p1"): Message {
  return {
    id: `id-${clientId}`,
    conversationId: "c1",
    clientId,
    author: { kind: "person", id: authorId, name: "Ana Souza", username: "pessoa", initials: "AS" },
    body: "Olá",
    createdAt: "2026-11-09T12:00:00.000Z",
    editedAt: null,
    mentions: [],
    quote: null,
    quickReplies: null,
    businessData: false,
    blocked: false,
    report: null,
  };
}

describe("withoutDelivered", () => {
  it("tira a pendente de mesmo client_id", () => {
    const pending = [message("a"), message("b")];

    expect(withoutDelivered(pending, message("a")).map((item) => item.clientId)).toEqual(["b"]);
  });

  it("mantém a pendente de outra autora com o mesmo client_id", () => {
    const pending = [message("a", "p1")];

    expect(withoutDelivered(pending, message("a", "p2"))).toHaveLength(1);
  });
});
