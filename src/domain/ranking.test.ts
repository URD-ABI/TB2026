import { describe, expect, it } from "vitest";
import { compareTeams, rankTeams } from "./ranking";
import { makeTeam } from "../test/fixtures";

describe("rankTeams", () => {
  it("trie par points puis clés sans déplacer la position d’affichage", () => {
    const teams = [
      makeTeam({ id: "a", displayOrder: 0, points: 100, keys: 2 }),
      makeTeam({ id: "b", displayOrder: 1, points: 100, keys: 3 }),
      makeTeam({ id: "c", displayOrder: 2, points: 80, keys: 8 }),
    ];
    expect(rankTeams(teams).map(({ team, rank }) => [team.id, rank])).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 3],
    ]);
  });

  it("exige un départage si points et clés sont identiques", () => {
    const teams = [makeTeam({ id: "a" }), makeTeam({ id: "b" })];
    expect(rankTeams(teams).every((entry) => entry.requiresTieBreak)).toBe(true);
  });

  it("utilise les priorités de départage explicites", () => {
    const teams = [
      makeTeam({ id: "a", displayOrder: 0, points: 50, keys: 2, tieBreakPriority: 2 }),
      makeTeam({ id: "b", displayOrder: 1, points: 50, keys: 2, tieBreakPriority: 1 }),
    ];
    expect(rankTeams(teams).map(({ team, rank, requiresTieBreak }) => [team.id, rank, requiresTieBreak])).toEqual([
      ["a", 2, false],
      ["b", 1, false],
    ]);
  });

  it("expose un comparateur qui considère les équipes identiques comme égales", () => {
    const first = makeTeam({ id: "a", displayOrder: 0, points: 20, keys: 2, tieBreakPriority: 1 });
    const second = makeTeam({ id: "b", displayOrder: 9, points: 20, keys: 2, tieBreakPriority: 1 });
    expect(compareTeams(first, second)).toBe(0);
    expect(compareTeams(second, first)).toBe(0);
  });
});
