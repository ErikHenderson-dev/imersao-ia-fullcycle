import { describe, expect, it } from "vitest";
import type { Agent } from "@/app/services/agents-service";
import { agentMentionOptions, mentionedAgentUsername, needsAgentRegistry } from "./agent-mentions";

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

// O Agente que o BFF manda como agent_username (spec da F11, "Disparo pelo BFF"; F11-T03, CA3).
describe("mentionedAgentUsername", () => {
  const agents = [agent("assistente", "Assistente"), agent("revisor", "Revisor", false)];

  it("reconhece o @usuário de um Agente conectado no limite de palavra", () => {
    expect(mentionedAgentUsername("@assistente resume hoje", agents)).toBe("assistente");
    expect(mentionedAgentUsername("Oi @assistente, tudo bem?", agents)).toBe("assistente");
    expect(mentionedAgentUsername("resume isso\n@ASSISTENTE", agents)).toBe("assistente");
  });

  it("não reconhece Agente desconectado, @usuário maior nem e-mail", () => {
    expect(mentionedAgentUsername("@revisor confere", agents)).toBeNull();
    expect(mentionedAgentUsername("@assistentes resume", agents)).toBeNull();
    expect(mentionedAgentUsername("escreva para time@assistente", agents)).toBeNull();
    expect(mentionedAgentUsername("assistente, resume", agents)).toBeNull();
  });

  it("não reconhece o @usuário dentro de um link", () => {
    expect(mentionedAgentUsername("veja https://exemplo.com/@assistente", agents)).toBeNull();
  });

  it("não reconhece nada com o registro fora", () => {
    expect(mentionedAgentUsername("@assistente resume", null)).toBeNull();
  });
});

describe("needsAgentRegistry", () => {
  it("só pede o registro quando o texto tem @", () => {
    expect(needsAgentRegistry("@assistente resume")).toBe(true);
    expect(needsAgentRegistry("resume a conversa")).toBe(false);
  });
});
