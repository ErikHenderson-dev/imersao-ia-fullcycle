import { describe, expect, it } from "vitest";
import type { Conversation } from "@/app/services/chat-api";
import { composerLabel, conversationTitle } from "./conversation-title";

const channel: Pick<Conversation, "kind" | "name" | "counterpart"> = {
  kind: "public_channel",
  name: "geral",
  counterpart: null,
};
const direct: Pick<Conversation, "kind" | "name" | "counterpart"> = {
  kind: "direct",
  name: "",
  counterpart: { id: "regina", name: "Regina Fonseca", username: "regina", initials: "RF" },
};

describe("nome da Conversa nos rótulos", () => {
  it("usa #nome no Canal e o nome da outra Pessoa na Conversa direta", () => {
    expect(conversationTitle(channel)).toBe("#geral");
    expect(conversationTitle(direct)).toBe("Regina Fonseca");
  });

  it("monta o rótulo da caixa de mensagem", () => {
    expect(composerLabel(channel, "eu")).toBe("Mensagem para #geral");
    expect(composerLabel(direct, "eu")).toBe("Mensagem para Regina");
    expect(composerLabel(direct, "regina")).toBe("Mensagem para você");
  });
});
