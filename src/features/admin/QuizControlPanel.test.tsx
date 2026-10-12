import { act, render, screen, within } from "@testing-library/react";
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
    onToggleAccess: vi.fn(), onStart: vi.fn(), onReveal: vi.fn(), onAnswer: vi.fn(), onReset: vi.fn(),
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

  it("annule la réinitialisation avec Échap et restaure le focus", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<QuizControlPanel {...base} onReset={onReset} />);

    const trigger = screen.getByRole("button", { name: /^réinitialiser le quiz$/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: /confirmer la réinitialisation du quiz/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /confirmer la réinitialisation du quiz/i })).not.toBeInTheDocument();
    expect(onReset).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });

  it("confirme une seule réinitialisation et annonce sa réussite", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const onReset = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<QuizControlPanel {...base} onReset={onReset} />);

    const trigger = screen.getByRole("button", { name: /^réinitialiser le quiz$/i });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /confirmer la réinitialisation du quiz/i });
    expect(dialog).toHaveTextContent(/points attribués par le quiz/i);
    const confirm = within(dialog).getByRole("button", { name: /confirmer la réinitialisation/i });
    await user.click(confirm);
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onReset).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledWith("event-1");

    await act(async () => finish());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/quiz réinitialisé/i);
    expect(trigger).toHaveFocus();
  });

  it("conserve la confirmation et affiche une erreur générique si le reset échoue", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn().mockRejectedValue(new Error("JWT expired for admin@example.fr"));
    render(<QuizControlPanel {...base} onReset={onReset} />);

    await user.click(screen.getByRole("button", { name: /^réinitialiser le quiz$/i }));
    await user.click(screen.getByRole("button", { name: /confirmer la réinitialisation/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/réinitialisation du quiz impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/jwt|admin@example\.fr/i);
    expect(screen.getByRole("dialog", { name: /confirmer la réinitialisation du quiz/i })).toBeInTheDocument();
  });
});
