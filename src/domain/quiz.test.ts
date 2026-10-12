import { describe, expect, it } from "vitest";
import { makeTeam } from "../test/fixtures";
import { canChooseCategory, freezeQuizOrder, validateAdminQuizChoices } from "./quiz";

const validChoices = [
  { id: "a", questionId: "q", text: "Une baguette", displayOrder: 0, isCorrect: false },
  { id: "b", questionId: "q", text: "Un médaillon", displayOrder: 1, isCorrect: false },
  { id: "c", questionId: "q", text: "Une clé", displayOrder: 2, isCorrect: true },
  { id: "d", questionId: "q", text: "Un grimoire", displayOrder: 3, isCorrect: false },
];

describe("validateAdminQuizChoices", () => {
  it("accepte quatre réponses distinctes avec une seule bonne réponse", () => {
    expect(validateAdminQuizChoices(validChoices)).toEqual({ valid: true, reason: null });
  });

  it("refuse une liste incomplète ou vide", () => {
    expect(validateAdminQuizChoices(validChoices.slice(0, 3))).toEqual({ valid: false, reason: "choice_count" });
    expect(validateAdminQuizChoices(validChoices.map((choice, index) => index === 3 ? { ...choice, text: " " } : choice))).toEqual({ valid: false, reason: "choice_count" });
  });

  it("refuse les doublons sans tenir compte de la casse et des espaces", () => {
    expect(validateAdminQuizChoices(validChoices.map((choice, index) => index === 3 ? { ...choice, text: " une CLÉ " } : choice))).toEqual({ valid: false, reason: "duplicate_choice" });
  });

  it("exige exactement une bonne réponse", () => {
    expect(validateAdminQuizChoices(validChoices.map((choice) => ({ ...choice, isCorrect: false })))).toEqual({ valid: false, reason: "correct_choice_count" });
    expect(validateAdminQuizChoices(validChoices.map((choice, index) => ({ ...choice, isCorrect: index < 2 })))).toEqual({ valid: false, reason: "correct_choice_count" });
  });
});

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

  it("refuse un groupe ex aequo si une seule priorité de départage manque", () => {
    expect(() => freezeQuizOrder([
      makeTeam({ id: "team-a", points: 50, keys: 3, tieBreakPriority: 1 }),
      makeTeam({ id: "team-b", points: 50, keys: 3, tieBreakPriority: null }),
    ])).toThrow(/départage/i);
  });

  it("refuse un groupe ex aequo dont les priorités de départage ne sont pas toutes distinctes", () => {
    expect(() => freezeQuizOrder([
      makeTeam({ id: "team-a", points: 50, keys: 3, tieBreakPriority: 1 }),
      makeTeam({ id: "team-b", points: 50, keys: 3, tieBreakPriority: 1 }),
      makeTeam({ id: "team-c", points: 50, keys: 3, tieBreakPriority: 2 }),
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
