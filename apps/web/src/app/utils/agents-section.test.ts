import { describe, expect, it } from "vitest";
import type { Agent } from "@/app/services/agents-service";
import { agentsSectionView } from "./agents-section";

function agent(slug: string, connected: boolean): Agent {
  return { slug, name: slug, username: slug, description: "", connected };
}

describe("agentsSectionView", () => {
  it("mostra a quem não administra os conectados, na ordem da lista, e Ver agentes", () => {
    const agents = [agent("alfa", true), agent("beta", false), agent("gama", true)];

    expect(agentsSectionView({ isAdmin: false, agents })).toEqual({
      rows: [agents[0], agents[2]],
      action: "view",
      count: 0,
    });
  });

  it("mostra só Ver agentes a quem não administra sem nenhum conectado", () => {
    expect(agentsSectionView({ isAdmin: false, agents: [agent("alfa", false)] })).toEqual({
      rows: [],
      action: "view",
      count: 0,
    });
  });

  it("com a lista indisponível, não mostra linhas e mostra Ver agentes a quem não administra", () => {
    expect(agentsSectionView({ isAdmin: false, agents: null })).toEqual({
      rows: [],
      action: "view",
      count: 0,
    });
  });

  it("com a lista indisponível, mostra Gerenciar agentes ao administrador", () => {
    expect(agentsSectionView({ isAdmin: true, agents: null })).toEqual({
      rows: [],
      action: "manage",
      count: 0,
    });
  });
});
