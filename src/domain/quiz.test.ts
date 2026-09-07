import { describe, expect, it } from "vitest";
import { makeTeam } from "../test/fixtures";
import { canChooseCategory, freezeQuizOrder } from "./quiz";

describe("freezeQuizOrder", () => {
  it("fige l’ordre par points, puis clés, puis départage manuel", () => {
    const teams = [
      makeTeam({ id: "team-d", points: 40, keys: 8, tieBreakPriority: null }),
      makeTeam({ id: "team-c", points: 80, keys: 2, tieBreakPriority: 2 }),
      makeTeam({ id: "team-a", points: 100, keys: 0, tieBreakPriority: null }),
      makeTeam({ id: "team-e", points: 20, keys: 9, tieBreakPriority: null }),
      makeTeam({ id: "team-b", points: 80, keys: 2, tieBreakPriority: 1 }),
    ];

    expect(freezeQuizOrder(teams)).toEqual([
      "team-a",
      "team-b",
      "team-c",
      "team-d",
      "team-e",
    ]);
  });

  it("refuse de figer l’ordre lorsqu’un départage reste non résolu", () => {
    expect(() => freezeQuizOrder([
      makeTeam({ id: "team-a", points: 50, keys: 3, tieBreakPriority: null }),
      makeTeam({ id: "team-b", points: 50, keys: 3, tieBreakPriority: null }),
    ])).toThrow(/départage/i);
  });
});

describe("canChooseCategory", () => {
  const available = {
    id: "category-a",
    eventId: "event-1",
    title: "Sortilèges",
    imageUrl: null,
    displayOrder: 0,
    status: "available" as const,
    chosenByTeamId: null,
  };

  it("autorise l’équipe courante à choisir un thème disponible", () => {
    expect(canChooseCategory(available, [], "team-a")).toBe(true);
  });

  it("interdit un thème déjà choisi et une seconde sélection de la même équipe", () => {
    expect(canChooseCategory({ ...available, chosenByTeamId: "team-b" }, [], "team-a")).toBe(false);
    expect(canChooseCategory({ ...available, status: "played" }, [], "team-a")).toBe(false);
    expect(canChooseCategory(available, ["team-a"], "team-a")).toBe(false);
  });
});
