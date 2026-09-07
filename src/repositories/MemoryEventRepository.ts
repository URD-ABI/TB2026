import type { EventRepository, EventSnapshot, Unsubscribe } from "./EventRepository";

type Listener = (snapshot: EventSnapshot) => void;

export class MemoryEventRepository implements EventRepository {
  private snapshot: EventSnapshot;
  private readonly assignments: Record<string, string>;
  private readonly listeners = new Set<Listener>();
  private readonly appliedScores = new Set<string>();

  constructor(snapshot: EventSnapshot, assignments: Record<string, string>) {
    this.snapshot = structuredClone(snapshot);
    this.assignments = { ...assignments };
  }

  private clone(): EventSnapshot {
    return structuredClone(this.snapshot);
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.clone());
  }

  async getSnapshot(slug: string): Promise<EventSnapshot> {
    if (this.snapshot.event.slug !== slug) throw new Error("event_not_found");
    return this.clone();
  }

  subscribe(slug: string, listener: Listener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.clone());
    return () => this.listeners.delete(listener);
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

  async revealParticipant(eventId: string, participantId: string): Promise<{ participantId: string; teamId: string }> {
    const participant = this.snapshot.participants.find((item) => item.eventId === eventId && item.id === participantId);
    if (!participant) throw new Error("no_participant");
    if (participant.revealedAt !== null) {
      if (participant.revealedTeamId === null) throw new Error("assignment_missing");
      return { participantId: participant.id, teamId: participant.revealedTeamId };
    }
    const nextParticipant = this.snapshot.participants
      .filter((item) => item.eventId === eventId && item.revealedAt === null)
      .sort((left, right) => left.revealOrder - right.revealOrder)[0];
    if (!nextParticipant || nextParticipant.id !== participantId) throw new Error("not_next_participant");
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
    const target = this.snapshot.teams.find((team) => team.id === input.teamId && team.eventId === input.eventId);
    if (!target) throw new Error("team_not_found");
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

  async chooseQuizCategory(input: Parameters<EventRepository["chooseQuizCategory"]>[0]): Promise<void> {
    const session = this.snapshot.quizSession;
    if (!this.snapshot.event.quizEnabled) throw new Error("quiz_disabled");
    if (!session || session.id !== input.sessionId || session.eventId !== input.eventId || session.startedAt === null) {
      throw new Error("quiz_not_started");
    }
    const category = this.snapshot.categories.find((item) => item.id === input.categoryId && item.eventId === input.eventId);
    if (!category || category.status !== "available" || category.chosenByTeamId !== null) {
      throw new Error("category_unavailable");
    }
    if (this.snapshot.categories.some((item) => item.eventId === input.eventId && item.chosenByTeamId === input.teamId)) {
      throw new Error("team_already_chosen");
    }
    if (session.activeCategoryId !== null) throw new Error("category_in_progress");
    if (session.teamOrder[session.currentTeamIndex] !== input.teamId) throw new Error("not_current_team");
    if (!this.snapshot.questions.some((question) => question.categoryId === category.id)) throw new Error("category_has_no_questions");

    this.snapshot = {
      ...this.snapshot,
      categories: this.snapshot.categories.map((item) => item.id === category.id
        ? { ...item, chosenByTeamId: input.teamId }
        : item),
      quizSession: {
        ...session,
        activeCategoryId: category.id,
        activeQuestionIndex: 0,
        answerVisible: false,
        revealedAnswer: null,
      },
    };
    this.emit();
  }
}
