import { describe, expect, it } from "vitest";
import type { QuickReplies } from "@/app/services/chat-api";
import { quickRepliesState } from "./quick-replies";

const ANA = "01a1cc88-0000-7000-8000-00000000000a";
const BRUNO = "01a1cc88-0000-7000-8000-00000000000b";
const EXPIRES_AT = "2026-11-10T19:00:00.000Z";

const open: QuickReplies = {
  options: ["Hoje (3)", "Desde ontem (5)", "A semana (12)", "Tudo (24)"],
  ownerId: ANA,
  expiresAt: EXPIRES_AT,
  closed: false,
};

const before = new Date("2026-11-10T18:30:00.000Z");

describe("quickRepliesState", () => {
  it("é ativa para quem pediu, antes do vencimento", () => {
    expect(quickRepliesState(open, ANA, before)).toBe("active");
  });

  it("é de outro Membro para quem não pediu", () => {
    expect(quickRepliesState(open, BRUNO, before)).toBe("other_member");
  });

  it.each([ANA, BRUNO])("está encerrada para todos depois da resposta (%s)", (personId) => {
    expect(quickRepliesState({ ...open, closed: true }, personId, before)).toBe("closed");
  });

  it.each([ANA, BRUNO])("está encerrada para todos depois do vencimento (%s)", (personId) => {
    expect(quickRepliesState(open, personId, new Date("2026-11-10T19:00:01.000Z"))).toBe("closed");
  });

  it("vence no instante exato do expires_at", () => {
    expect(quickRepliesState(open, ANA, new Date(EXPIRES_AT))).toBe("closed");
  });
});
