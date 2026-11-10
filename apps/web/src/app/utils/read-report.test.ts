import { describe, expect, it } from "vitest";
import { hasUnreadToReport, readReportDelay } from "./read-report";

const OLD = "01a1c5a4-0000-7000-8000-000000000001";
const NEW = "01a1c5a4-0000-7000-8000-000000000002";

describe("hasUnreadToReport", () => {
  it("há o que informar só com uma Mensagem posterior à Última leitura", () => {
    expect(hasUnreadToReport(NEW, OLD)).toBe(true);
    expect(hasUnreadToReport(NEW, null)).toBe(true);
    expect(hasUnreadToReport(OLD, OLD)).toBe(false);
    expect(hasUnreadToReport(OLD, NEW)).toBe(false);
    expect(hasUnreadToReport(undefined, OLD)).toBe(false);
  });
});

describe("readReportDelay", () => {
  it("espera o resto do intervalo desde o último envio", () => {
    expect(readReportDelay(null, 10_000, 1_000)).toBe(0);
    expect(readReportDelay(9_700, 10_000, 1_000)).toBe(700);
    expect(readReportDelay(9_000, 10_000, 1_000)).toBe(0);
    expect(readReportDelay(5_000, 10_000, 1_000)).toBe(0);
  });
});
