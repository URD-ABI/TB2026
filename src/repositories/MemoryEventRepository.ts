import type { EventRepository, EventSnapshot, Unsubscribe } from "./EventRepository";

type Listener = (snapshot: EventSnapshot) => void;

export class MemoryEventRepository implements EventRepository {
  private snapshot: EventSnapshot;
  private readonly assignments: Record<string, string>;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly appliedScores = new Set<string>();

  constructor(snapshot: EventSnapshot, assignments: Record<string, string>) {
    this.snapshot = structuredClone(snapshot);
    this.assignments = { ...assignments };
  }

  private clone(): EventSnapshot {
    return structuredClone(this.snapshot);
  }

  private emit(): void {
    for (const listeners of this.listeners.values()) {
      for (const listener of listeners) listener(this.clone());
    }
  }

  async getSnapshot(slug: string): Promise<EventSnapshot> {
    if (this.snapshot.event.slug !== slug) throw new Error("event_not_found");
    return this.clone();
  }

  subscribe(slug: string, listener: Listener): Unsubscribe {
    const set = this.listeners.get(slug) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(slug, set);
    listener(this.clone());
    return () => set.delete(listener);
  }

  async updateEvent(event: EventSnapshot["event"]): Promise<void> {
    this.snapshot = { ...this.snapshot, event: structuredClone(event) };
    this.emit();
  }

  async updateTeam(team: EventSnapshot["teams"][number]): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      teams: this.snapshot.teams.map((current) => current.id === team.id ? structuredClone(team) : current),
    };
    this.emit();
  }

  async revealNextParticipant(eventId: string): Promise<{ participantId: string; teamId: string }> {
    const participant = this.snapshot.participants
      .filter((item) => item.eventId === eventId && item.revealedAt === null)
      .sort((left, right) => left.revealOrder - right.revealOrder)[0];
    if (!participant) throw new Error("no_participant");
    const teamId = this.assignments[participant.id];
    if (!teamId) throw new Error("assignment_missing");
    this.snapshot = {
      ...this.snapshot,
      participants: this.snapshot.participants.map((item) => item.id === participant.id
        ? { ...item, revealedTeamId: teamId, revealedAt: new Date().toISOString() }
        : item),
    };
    this.emit();
    return { participantId: participant.id, teamId };
  }

  async applyScore(input: Parameters<EventRepository["applyScore"]>[0]): Promise<void> {
    if (this.appliedScores.has(input.idempotencyKey)) return;
    this.appliedScores.add(input.idempotencyKey);
    this.snapshot = {
      ...this.snapshot,
      teams: this.snapshot.teams.map((team) => team.id === input.teamId && team.eventId === input.eventId
        ? { ...team, points: team.points + input.points, keys: team.keys + input.keys, tieBreakPriority: null }
        : team),
    };
    this.emit();
  }
}
