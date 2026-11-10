import { describe, expect, it } from "vitest";
import { localTimeLabel, msUntilNextMinute } from "./local-time";

describe("hora local do Perfil", () => {
  it("monta a hora em outro fuso", () => {
    const now = new Date("2026-11-09T17:32:10Z");

    expect(localTimeLabel("Asia/Tokyo", now)).toBe("02:32 no horário local");
    expect(localTimeLabel("America/Sao_Paulo", now)).toBe("14:32 no horário local");
  });

  it("conta o tempo até a virada do minuto", () => {
    expect(msUntilNextMinute(new Date("2026-11-09T17:32:10.250Z"))).toBe(49_750);
    expect(msUntilNextMinute(new Date("2026-11-09T17:32:00Z"))).toBe(60_000);
  });
});
