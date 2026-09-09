import { describe, expect, it } from "vitest";
import { makeEventSnapshot } from "../test/fixtures";
import { buildEventExport, eventExportFilename } from "./export";

describe("event export", () => {
  it("exporte une version datée sans données de connexion", () => {
    const exported = buildEventExport(makeEventSnapshot(), new Date("2026-12-18T10:00:00Z"));
    expect(exported.version).toBe(1);
    expect(exported.exportedAt).toBe("2026-12-18T10:00:00.000Z");
    expect(JSON.stringify(exported)).not.toMatch(/password|anon_key|access_token|quizSession/i);
    expect(eventExportFilename(new Date("2026-12-18T10:00:00Z"))).toBe("team-building-2026-2026-12-18.json");
  });
});
