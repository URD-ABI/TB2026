import type { Challenge, EventConfig, Participant, QuizCategory, QuizQuestion, Team } from "../domain/types";

export type EventSnapshot = {
  event: EventConfig;
  teams: Team[];
  participants: Participant[];
  challenges: Challenge[];
  categories: QuizCategory[];
  questions: QuizQuestion[];
};

export type Unsubscribe = () => void;

export interface EventRepository {
  getSnapshot(slug: string): Promise<EventSnapshot>;
  subscribe(slug: string, listener: (snapshot: EventSnapshot) => void): Unsubscribe;
  updateEvent(event: EventConfig): Promise<void>;
  updateTeam(team: Team): Promise<void>;
  revealNextParticipant(eventId: string): Promise<{ participantId: string; teamId: string }>;
  applyScore(input: { eventId: string; teamId: string; points: number; keys: number; source: string; idempotencyKey: string }): Promise<void>;
}

