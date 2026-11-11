import { describe, expect, it } from "vitest";
import type { Agent } from "@/app/services/agents-service";
import { agentMentionOptions } from "./agent-mentions";

function agent(slug: string, name: string, connected = true): Agent {
  return { slug, name, username: slug, description: "", connected };
}

describe("agentMentionOptions", () => {
  const agents = [
    agent("assistente", "Assistente"),
    agent("analista", "Análise"),
    agent("revisor", "Revisor", false),
  ];

  it("traz os conectados cujo nome ou @usuário começa pelo texto, sem diferenciar maiúsculas e acentos", () => {
    expect(agentMentionOptions(agents, "ASS")).toEqual([agents[0]]);
    expect(agentMentionOptions(agents, "anál")).toEqual([agents[1]]);
    expect(agentMentionOptions(agents, "anal")).toEqual([agents[1]]);
  });

  it("traz todos os conectados, na ordem da lista, com o texto vazio", () => {
    expect(agentMentionOptions(agents, "")).toEqual([agents[0], agents[1]]);
  });

  it("não traz os desconectados nem quem não começa pelo texto", () => {
    expect(agentMentionOptions(agents, "rev")).toEqual([]);
    expect(agentMentionOptions(agents, "tente")).toEqual([]);
  });

  it("não traz nenhum com a lista indisponível", () => {
    expect(agentMentionOptions(null, "ass")).toEqual([]);
  });
});
