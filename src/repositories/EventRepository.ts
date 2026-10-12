import type { AdminParticipant, AdminQuizQuestion, Challenge, EventConfig, Participant, QuizCategory, QuizQuestion, QuizSession, ScoreEvent, Team } from "../domain/types";

export type CreateParticipantInput = {
  eventId: string;
  name: string;
  photoUrl: string | null;
  assignedTeamId: string;
  revealOrder: number;
};

export type CreateQuizQuestionInput = Omit<AdminQuizQuestion, "id">;

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
  updateChallenge(challenge: Challenge): Promise<void>;
  reorderChallenges(eventId: string, orderedIds: string[]): Promise<void>;
  getAdminQuizQuestions(eventId: string): Promise<AdminQuizQuestion[]>;
  updateQuizCategory(category: QuizCategory): Promise<void>;
  reorderQuizCategories(eventId: string, orderedIds: string[]): Promise<void>;
  createQuizQuestion(input: CreateQuizQuestionInput): Promise<void>;
  updateQuizQuestion(question: AdminQuizQuestion): Promise<void>;
  deleteQuizQuestion(questionId: string): Promise<void>;
  reorderQuizQuestions(categoryId: string, orderedIds: string[]): Promise<void>;
  uploadEventBackground(file: File, eventId: string): Promise<string>;
  uploadParticipantPhoto(file: File, eventId: string, participantId: string): Promise<string>;
  uploadChallengeImage(file: File, eventId: string, challengeId: string): Promise<string>;
  uploadQuizCategoryImage(file: File, eventId: string, categoryId: string): Promise<string>;
  cleanupPendingMedia(eventId: string): Promise<void>;
  removeMedia(url: string): Promise<void>;
  revealParticipant(eventId: string, participantId: string): Promise<{ participantId: string; teamId: string }>;
  applyScore(input: { eventId: string; teamId: string; points: number; keys: number; source: string; idempotencyKey: string }): Promise<void>;
  chooseQuizCategory(input: { eventId: string; sessionId: string; teamId: string; categoryId: string }): Promise<void>;
  startQuiz(eventId: string): Promise<void>;
  revealQuizAnswer(sessionId: string, questionId: string): Promise<void>;
  answerQuizQuestion(sessionId: string, questionId: string, correct: boolean, idempotencyKey: string): Promise<void>;
  resetQuiz(eventId: string): Promise<void>;
  getScoreHistory(eventId: string): Promise<ScoreEvent[]>;
  reverseScoreEvent(scoreEventId: string): Promise<void>;
  resetRehearsal(eventId: string): Promise<void>;
}
