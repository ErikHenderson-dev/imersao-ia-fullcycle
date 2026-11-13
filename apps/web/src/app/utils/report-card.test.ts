import { describe, expect, it } from "vitest";
import { formatReportSize, reportHref, reportOf } from "./report-card";

const report = { fileName: "relatorio-2026-03-01-a-2026-03-31.pdf", sizeBytes: 48_213 };
const bot = { kind: "bot" as const, id: "b", name: "Assistente", username: "assistente", initials: "AS" };
const person = { kind: "person" as const, id: "p", name: "Ana", username: "ana", initials: "AN" };

describe("formatReportSize", () => {
  it("formata o tamanho em KB e em MB", () => {
    expect(formatReportSize(48_213)).toBe("47,1 KB");
    expect(formatReportSize(512)).toBe("0,5 KB");
    expect(formatReportSize(1024 * 1024)).toBe("1,0 MB");
    expect(formatReportSize(2_621_440)).toBe("2,5 MB");
  });
});

describe("reportOf", () => {
  it("só a Mensagem com relatório e sem bloqueio mostra o cartão", () => {
    expect(reportOf({ author: bot, blocked: false, report })).toEqual(report);
    expect(reportOf({ author: bot, blocked: true, report })).toBeNull();
    expect(reportOf({ author: bot, blocked: false, report: null })).toBeNull();
    expect(reportOf({ author: person, blocked: false, report })).toBeNull();
  });
});

describe("reportHref", () => {
  it("aponta para a rota do BFF com o id da Mensagem", () => {
    expect(reportHref("01a1-x")).toBe("/api/messages/01a1-x/report");
  });
});
