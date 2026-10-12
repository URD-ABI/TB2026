import type { AdminQuizChoice, QuizCategory, Team } from "./types";
import { rankTeams } from "./ranking";

export function freezeQuizOrder(teams: Team[]): string[] {
  const ranked = rankTeams(teams);
  if (ranked.some((entry) => entry.requiresTieBreak)) {
    throw new Error("Un départage est requis avant le quiz");
  }
  return [...ranked]
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.team.id);
}

export function canChooseCategory(
  category: QuizCategory,
  chosenTeamIds: string[],
  teamId: string,
): boolean {
  return category.status === "available"
    && category.chosenByTeamId === null
    && !chosenTeamIds.includes(teamId);
}

export function validateAdminQuizChoices(choices: AdminQuizChoice[]) {
  if (choices.length !== 4 || choices.some((choice) => !choice.text.trim())) {
    return { valid: false as const, reason: "choice_count" as const };
  }
  const normalized = choices.map((choice) => choice.text.trim().toLocaleLowerCase("fr"));
  if (new Set(normalized).size !== 4) {
    return { valid: false as const, reason: "duplicate_choice" as const };
  }
  if (choices.filter((choice) => choice.isCorrect).length !== 1) {
    return { valid: false as const, reason: "correct_choice_count" as const };
  }
  return { valid: true as const, reason: null };
}
