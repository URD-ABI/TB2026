import type {
  Challenge,
  EventConfig,
  Participant,
  QuizCategory,
  QuizQuestion,
  Team,
} from "../domain/types";
import type { EventSnapshot } from "../repositories/EventRepository";

export function makeTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: "team-a",
    eventId: "event-1",
    name: "Équipe A",
    color: "#7c3aed",
    emblem: "✦",
    displayOrder: 0,
    points: 0,
    keys: 0,
    tieBreakPriority: null,
    ...overrides,
  };
}

export function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  return {
    id: "participant-1",
    eventId: "event-1",
    name: "Alex",
    photoUrl: null,
    revealedTeamId: null,
    revealOrder: 0,
    revealedAt: null,
    ...overrides,
  };
}

export function makeEvent(overrides: Partial<EventConfig> = {}): EventConfig {
  return {
    id: "event-1",
    slug: "tournoi-des-arcanes",
    title: "Le Tournoi des Arcanes",
    subtitle: "Team Building 2026",
    backgroundUrl: null,
    quizEnabled: true,
    scoreCapacity: 100,
    ...overrides,
  };
}

export function makeEventSnapshot(overrides: Partial<EventSnapshot> = {}): EventSnapshot {
  const event = makeEvent();
  const teams = [makeTeam()];
  const participants = [makeParticipant()];
  const challenges: Challenge[] = [];
  const categories: QuizCategory[] = [];
  const questions: QuizQuestion[] = [];
  const choices = [];
  const quizSession = null;
  return { event, teams, participants, challenges, categories, questions, choices, quizSession, ...overrides };
}
