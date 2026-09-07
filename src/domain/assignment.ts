import type { Participant } from "./types";

export function nextParticipant(participants: Participant[]): Participant | null {
  return [...participants]
    .filter((participant) => participant.revealedAt === null)
    .sort((left, right) => left.revealOrder - right.revealOrder)[0] ?? null;
}
