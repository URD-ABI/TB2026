import type { EventSnapshot } from "../repositories/EventRepository";

export function buildEventExport(snapshot: EventSnapshot, now = new Date()) {
  return {
    version: 1 as const,
    exportedAt: now.toISOString(),
    event: snapshot.event,
    teams: snapshot.teams,
    participants: snapshot.participants,
    challenges: snapshot.challenges,
    categories: snapshot.categories,
    questions: snapshot.questions,
  };
}

export function eventExportFilename(now = new Date()): string {
  return `team-building-2026-${now.toISOString().slice(0, 10)}.json`;
}
