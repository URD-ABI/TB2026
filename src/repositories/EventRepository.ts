import type { Challenge, EventConfig, Participant, QuizCategory, QuizQuestion, QuizSession, Team } from "../domain/types";

export type EventSnapshot = {
  event: EventConfig;
  teams: Team[];
  participants: Participant[];
  challenges: Challenge[];
  categories: QuizCategory[];
  questions: QuizQuestion[];
  quizSession: QuizSession | null;
};

export type Unsubscribe = () => void;
export type ConnectionStatus = "online" | "reconnecting";

export interface EventRepository {
  getSnapshot(slug: string): Promise<EventSnapshot>;
  subscribe(
    slug: string,
    listener: (snapshot: EventSnapshot) => void,
    connectionListener?: (status: ConnectionStatus) => void,
  ): Unsubscribe;
  updateEvent(event: EventConfig): Promise<void>;
  updateTeam(team: Team): Promise<void>;
  revealParticipant(eventId: string, participantId: string): Promise<{ participantId: string; teamId: string }>;
  applyScore(input: { eventId: string; teamId: string; points: number; keys: number; source: string; idempotencyKey: string }): Promise<void>;
  chooseQuizCategory(input: { eventId: string; sessionId: string; teamId: string; categoryId: string }): Promise<void>;
}
