import type { QuizCategory, Team } from "./types";
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
