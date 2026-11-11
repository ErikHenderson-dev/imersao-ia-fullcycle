import { describe, expect, it } from "vitest";
import { agentRequestFailure } from "./agent-request-failure";

// O que o BFF faz quando o Serviço de agentes não aceita o Pedido (spec da F11, "Disparo pelo BFF").
describe("agentRequestFailure", () => {
  it("no aceite, nada a fazer", () => {
    expect(agentRequestFailure({ kind: "accepted" })).toBeNull();
  });

  it("com o Agente desconectado (409), encerra como cancelled, sem erro", () => {
    expect(agentRequestFailure({ kind: "failure", status: 409 })).toEqual({ close: "cancelled", reason: null });
  });

  it("acima do limite (429), encerra como failed e mostra o limite", () => {
    expect(agentRequestFailure({ kind: "failure", status: 429 })).toEqual({ close: "failed", reason: "rate_limited" });
  });

  it.each([null, 404, 500, 503])("com %s, encerra como failed e mostra que o Agente não recebeu", (status) => {
    expect(agentRequestFailure({ kind: "failure", status })).toEqual({ close: "failed", reason: "unavailable" });
  });
});
