import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeEvent, makeTeam } from "../../test/fixtures";
import type { QuizCategory, QuizChoice, QuizQuestion, QuizSession } from "../../domain/types";
import { QuizControlPanel } from "./QuizControlPanel";

const teams = Array.from({ length: 5 }, (_, index) => makeTeam({
  id: `team-${index + 1}`, name: `Équipe ${index + 1}`, displayOrder: index, points: 50 - index * 10,
}));
const category: QuizCategory = { id: "category-1", eventId: "event-1", title: "Hiver", imageUrl: null, displayOrder: 0, status: "available", chosenByTeamId: null };
const question: QuizQuestion = { id: "question-1", categoryId: "category-1", prompt: "Question ?", points: 10, displayOrder: 0 };
const choices: QuizChoice[] = [
  { id: "choice-a", questionId: "question-1", text: "Une baguette", displayOrder: 0 },
  { id: "choice-b", questionId: "question-1", text: "Un médaillon", displayOrder: 1 },
  { id: "choice-c", questionId: "question-1", text: "Une clé", displayOrder: 2 },
  { id: "choice-d", questionId: "question-1", text: "Un grimoire", displayOrder: 3 },
];
const session: QuizSession = {
  id: "session-1", eventId: "event-1", teamOrder: teams.map((team) => team.id), currentTeamIndex: 0,
  activeCategoryId: "category-1", activeQuestionIndex: 0, selectedChoiceId: null, choiceLocked: false,
  answerVisible: false, revealedChoiceId: null, startedAt: "2026-12-18T10:00:00Z",
};

describe("QuizControlPanel", () => {
  const base = {
    event: makeEvent(), teams, categories: [category], questions: [question], choices, session,
    onToggleAccess: vi.fn(), onStart: vi.fn(), onLock: vi.fn(), onRevealAndScore: vi.fn(), onAdvance: vi.fn(), onReset: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it("exige un départage complet avant le démarrage", () => {
    const tied = teams.map((team, index) => index < 2 ? { ...team, points: 50, keys: 2, tieBreakPriority: null } : team);
    render(<QuizControlPanel {...base} teams={tied} session={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/départage/i);
    expect(screen.getByRole("button", { name: /démarrer/i })).toBeDisabled();
  });

  it("désactive le verrouillage tant qu’aucune réponse n’est choisie", () => {
    render(<QuizControlPanel {...base} />);

    expect(screen.getByRole("button", { name: "Verrouiller le choix" })).toBeDisabled();
  });

  it("affiche et verrouille le choix actuel", async () => {
    const user = userEvent.setup();
    const onLock = vi.fn().mockResolvedValue(undefined);
    render(<QuizControlPanel {...base} session={{ ...session, selectedChoiceId: "choice-b" }} onLock={onLock} />);

    expect(screen.getByText("Choix actuel : B — Un médaillon")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verrouiller le choix" }));
    expect(onLock).toHaveBeenCalledWith("session-1", "question-1");
  });

  it("révèle et note automatiquement un choix verrouillé", async () => {
    const user = userEvent.setup();
    const onRevealAndScore = vi.fn().mockResolvedValue(undefined);
    render(<QuizControlPanel {...base} session={{ ...session, selectedChoiceId: "choice-b", choiceLocked: true }} onRevealAndScore={onRevealAndScore} />);

    await user.click(screen.getByRole("button", { name: "Révéler la réponse" }));
    expect(onRevealAndScore).toHaveBeenCalledWith("session-1", "question-1");
  });

  it("passe à la question suivante seulement après la révélation", async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(<QuizControlPanel {...base} session={{
      ...session,
      selectedChoiceId: "choice-b",
      choiceLocked: true,
      answerVisible: true,
      revealedChoiceId: "choice-c",
    }} onAdvance={onAdvance} />);

    expect(screen.getByText(/mauvaise réponse/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Question suivante" }));
    expect(onAdvance).toHaveBeenCalledWith("session-1", "question-1");
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
