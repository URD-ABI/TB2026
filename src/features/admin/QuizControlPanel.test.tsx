import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeEvent, makeTeam } from "../../test/fixtures";
import type { QuizCategory, QuizQuestion, QuizSession } from "../../domain/types";
import { QuizControlPanel } from "./QuizControlPanel";

const teams = Array.from({ length: 5 }, (_, index) => makeTeam({
  id: `team-${index + 1}`, name: `Équipe ${index + 1}`, displayOrder: index, points: 50 - index * 10,
}));
const category: QuizCategory = { id: "category-1", eventId: "event-1", title: "Hiver", imageUrl: null, displayOrder: 0, status: "available", chosenByTeamId: null };
const question: QuizQuestion = { id: "question-1", categoryId: "category-1", prompt: "Question ?", points: 10, displayOrder: 0 };
const session: QuizSession = {
   id: "session-1", eventId: "event-1", teamOrder: teams.map((team) => team.id), currentTeamIndex: 0,
  activeCategoryId: "category-1", activeQuestionIndex: 0, answerVisible: false, revealedAnswer: null, startedAt: "2026-12-18T10:00:00Z",
};

describe("QuizControlPanel", () => {
  const base = {
    event: makeEvent(), teams, categories: [category], questions: [question], session,
    onToggleAccess: vi.fn(), onStart: vi.fn(), onReveal: vi.fn(), onAnswer: vi.fn(),
  };

  it("exige un départage complet avant le démarrage", () => {
    const tied = teams.map((team, index) => index < 2 ? { ...team, points: 50, keys: 2, tieBreakPriority: null } : team);
    render(<QuizControlPanel {...base} teams={tied} session={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/départage/i);
    expect(screen.getByRole("button", { name: /démarrer/i })).toBeDisabled();
  });

  it("empêche une double validation pendant l'appel atomique", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onAnswer = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<QuizControlPanel {...base} session={{ ...session, answerVisible: true, revealedAnswer: "Réponse" }} onAnswer={onAnswer} />);
    const correct = screen.getByRole("button", { name: /bonne réponse/i });
    await user.click(correct);
    expect(correct).toBeDisabled();
    await user.click(correct);
    expect(onAnswer).toHaveBeenCalledOnce();
    finish();
  });

  it("révèle la réponse avant d'autoriser la notation", async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn().mockResolvedValue(undefined);
    render(<QuizControlPanel {...base} onReveal={onReveal} />);
    expect(screen.getByRole("button", { name: /bonne réponse/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /révéler/i }));
    expect(onReveal).toHaveBeenCalledWith("session-1", "question-1");
  });
});
