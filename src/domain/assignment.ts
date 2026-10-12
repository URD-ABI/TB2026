import type { Participant } from "./types";

export type ReelStep = {
  teamId: string;
  delayMs: number;
  phase: "spinning" | "settling";
};

export function nextParticipant(participants: Participant[]): Participant | null {
  return [...participants]
    .filter((participant) => participant.revealedAt === null)
    .sort((left, right) => left.revealOrder - right.revealOrder)[0] ?? null;
}

export function buildReelSequence(teamIds: string[], targetTeamId: string): ReelStep[] {
  if (teamIds.length === 0 || !teamIds.includes(targetTeamId)) return [];

  const spinning: ReelStep[] = Array.from({ length: 2 }, () => teamIds)
    .flat()
    .map((teamId) => ({ teamId, delayMs: 70, phase: "spinning" }));
  const targetIndex = teamIds.indexOf(targetTeamId);
  const settlingIds = [...teamIds, ...teamIds.slice(0, targetIndex + 1)];
  const settling: ReelStep[] = settlingIds.map((teamId, index) => ({
    teamId,
    delayMs: 120 + index * 45,
    phase: "settling",
  }));

  return [...spinning, ...settling];
}
