import type { RankedTeam, Team } from "./types";

export function compareTeams(left: Team, right: Team): number {
  if (left.points !== right.points) return right.points - left.points;
  if (left.keys !== right.keys) return right.keys - left.keys;
  if (left.tieBreakPriority === null && right.tieBreakPriority !== null) return 1;
  if (left.tieBreakPriority !== null && right.tieBreakPriority === null) return -1;
  if (left.tieBreakPriority !== null && right.tieBreakPriority !== null && left.tieBreakPriority !== right.tieBreakPriority) {
    return left.tieBreakPriority - right.tieBreakPriority;
  }
  return 0;
}

export function rankTeams(teams: Team[]): RankedTeam[] {
  const sorted = [...teams].sort(compareTeams);
  const rankById = new Map<string, number>();
  sorted.forEach((team, index) => {
    const previous = sorted[index - 1];
    const tied = previous && previous.points === team.points && previous.keys === team.keys &&
      previous.tieBreakPriority === team.tieBreakPriority;
    rankById.set(team.id, tied ? (rankById.get(previous.id) ?? index + 1) : index + 1);
  });

  return [...teams]
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((team) => ({
      team,
      rank: rankById.get(team.id) ?? 0,
      requiresTieBreak: teams.some((other) => other.id !== team.id && other.points === team.points && other.keys === team.keys && team.tieBreakPriority === null && other.tieBreakPriority === null),
    }));
}
