import type { AdminParticipant, Challenge, EventConfig, Participant, QuizCategory, QuizQuestion, QuizSession, Team } from "../domain/types";

export type CreateParticipantInput = {
  eventId: string;
  name: string;
  photoUrl: string | null;
  assignedTeamId: string;
  revealOrder: number;
};

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
  getAdminParticipants(eventId: string): Promise<AdminParticipant[]>;
  createParticipant(input: CreateParticipantInput): Promise<void>;
  updateParticipant(participant: AdminParticipant): Promise<void>;
  deleteParticipant(eventId: string, participantId: string): Promise<void>;
  reorderParticipants(eventId: string, orderedParticipantIds: string[]): Promise<void>;
  resetParticipantReveals(eventId: string): Promise<void>;
  setTeamTieBreakOrder(eventId: string, orderedTeamIds: string[]): Promise<void>;
  uploadEventBackground(file: File, eventId: string): Promise<string>;
  uploadParticipantPhoto(file: File, eventId: string, participantId: string): Promise<string>;
  cleanupPendingMedia(eventId: string): Promise<void>;
  removeMedia(url: string): Promise<void>;
  revealParticipant(eventId: string, participantId: string): Promise<{ participantId: string; teamId: string }>;
  applyScore(input: { eventId: string; teamId: string; points: number; keys: number; source: string; idempotencyKey: string }): Promise<void>;
  chooseQuizCategory(input: { eventId: string; sessionId: string; teamId: string; categoryId: string }): Promise<void>;
}
