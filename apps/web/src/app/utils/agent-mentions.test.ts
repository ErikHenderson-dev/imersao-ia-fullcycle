import { describe, expect, it } from "vitest";
import type { Agent } from "@/app/services/agents-service";
import {
  agentMentionOptions,
  agentRequestMentions,
  agentRequestQuote,
  agentRequester,
  mentionedAgentUsername,
  needsAgentRegistry,
} from "./agent-mentions";

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

  it("acha pelo @usuário digitado em maiúsculas quando o nome não começa pelo texto", () => {
    const helper = agent("assistente", "Ajudante");
    expect(agentMentionOptions([helper], "ASS")).toEqual([helper]);
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

describe("agentRequestMentions", () => {
  const mentions = [
    { id: "p1", username: "bruno" },
    { id: "p2", username: "carla" },
  ];

  it("leva o nome de cada Pessoa mencionada pelos Membros", () => {
    const members = [
      { id: "p2", name: "Carla Dias" },
      { id: "p1", name: "Bruno Lima" },
    ];

    expect(agentRequestMentions(mentions, members)).toEqual([
      { username: "bruno", name: "Bruno Lima" },
      { username: "carla", name: "Carla Dias" },
    ]);
  });

  it("sem a lista de Membros, usa o @usuário como nome", () => {
    expect(agentRequestMentions(mentions, null)).toEqual([
      { username: "bruno", name: "bruno" },
      { username: "carla", name: "carla" },
    ]);
  });

  it("sem Menção, não leva nenhuma", () => {
    expect(agentRequestMentions([], null)).toEqual([]);
  });
});

describe("agentRequestQuote", () => {
  const author = { kind: "person" as const, id: "ana", name: "Ana Souza", username: "ana" };

  it("traz a Mensagem citada, com o texto atual e o autor", () => {
    expect(agentRequestQuote({ id: "m1", deleted: false, author, body: "Revisar o contrato" })).toEqual({
      id: "m1",
      body: "Revisar o contrato",
      author: { name: "Ana Souza", username: "ana" },
    });
  });

  it("é nula sem Citação ou com a citada apagada", () => {
    expect(agentRequestQuote(null)).toBeNull();
    expect(agentRequestQuote({ id: "m1", deleted: true })).toBeNull();
  });
});

describe("agentRequester", () => {
  const author = { id: "p1", name: "Ana Souza", username: "ana" };

  it("o requester leva a Permissão de dados da Pessoa da Sessão", () => {
    expect(agentRequester(author, { kind: "ok", person: { dataAccess: true } })).toEqual({
      id: "p1",
      name: "Ana Souza",
      username: "ana",
      dataAccess: true,
    });
  });

  it("sem a Pessoa da Sessão, o requester vai sem Permissão de dados", () => {
    expect(agentRequester(author, { kind: "failure" })).toEqual({
      id: "p1",
      name: "Ana Souza",
      username: "ana",
      dataAccess: false,
    });
  });
});
