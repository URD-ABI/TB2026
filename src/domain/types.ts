export type Id = string;

export type Team = {
  id: Id;
  eventId: Id;
  name: string;
  color: string;
  emblem: string;
  displayOrder: number;
  points: number;
  keys: number;
  tieBreakPriority: number | null;
};

export type Participant = {
  id: Id;
  eventId: Id;
  name: string;
  photoUrl: string | null;
  revealedTeamId: Id | null;
  revealOrder: number;
  revealedAt: string | null;
};

export type AdminParticipant = Participant & { assignedTeamId: Id };

export type Challenge = {
  id: Id;
  eventId: Id;
  title: string;
  kind: string;
  description: string;
  imageUrl: string | null;
  displayOrder: number;
};

export type QuizCategory = {
  id: Id;
  eventId: Id;
  title: string;
  imageUrl: string | null;
  displayOrder: number;
  status: "available" | "played";
};

export type QuizQuestion = {
  id: Id;
  categoryId: Id;
  prompt: string;
  points: number;
  displayOrder: number;
};

export type AdminQuizQuestion = QuizQuestion & { answer: string };

export type EventConfig = {
  id: Id;
  slug: string;
  title: string;
  subtitle: string;
  backgroundUrl: string | null;
  quizEnabled: boolean;
};

export type RankedTeam = { team: Team; rank: number; requiresTieBreak: boolean };

