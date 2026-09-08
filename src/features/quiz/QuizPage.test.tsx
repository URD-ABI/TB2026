import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { QuizCategory, QuizQuestion, Team } from "../../domain/types";
import { MemoryEventRepository } from "../../repositories/MemoryEventRepository";
import type { EventSnapshot } from "../../repositories/EventRepository";
import { makeEvent, makeEventSnapshot, makeTeam } from "../../test/fixtures";
import { QuizPage } from "./QuizPage";

const EVENT_SLUG = "tournoi-des-arcanes";

const teams: Team[] = [
  makeTeam({ id: "team-a", name: "Lynx d’argent", displayOrder: 0, points: 10 }),
  makeTeam({ id: "team-b", name: "Hiboux de givre", displayOrder: 1, points: 500 }),
  makeTeam({ id: "team-c", name: "Cerfs dorés", displayOrder: 2, points: 30 }),
  makeTeam({ id: "team-d", name: "Renards de braise", displayOrder: 3, points: 20 }),
  makeTeam({ id: "team-e", name: "Loups des mers", displayOrder: 4, points: 40 }),
];

const categories: QuizCategory[] = Array.from({ length: 6 }, (_, index) => ({
  id: `category-${index + 1}`,
  eventId: "event-1",
  title: ["Sortilèges", "Océans", "Noël", "Énigmes", "Cinéma", "Forteresses"][index],
  imageUrl: null,
  displayOrder: index,
  status: index === 4 ? "played" : "available",
  chosenByTeamId: index === 4 ? "team-d" : null,
}));

const questions: QuizQuestion[] = [{
  id: "question-1",
  categoryId: "category-1",
  prompt: "Quel sort éclaire l’extrémité d’une baguette ?",
  points: 20,
  displayOrder: 0,
}];

function renderQuiz(overrides: Partial<EventSnapshot> = {}) {
  const snapshot = makeEventSnapshot({
    event: makeEvent({ quizEnabled: true }),
    teams,
    categories,
    questions,
    quizSession: {
      id: "session-1",
      eventId: "event-1",
      teamOrder: ["team-c", "team-a", "team-e", "team-d", "team-b"],
      currentTeamIndex: 0,
      activeCategoryId: null,
      activeQuestionIndex: 0,
      answerVisible: false,
      revealedAnswer: null,
      startedAt: "2026-12-18T18:00:00Z",
    },
    ...overrides,
  });
  const repository = new MemoryEventRepository(snapshot, {});
  return {
    repository,
    ...render(
      <AppProviders repository={repository} eventSlug={EVENT_SLUG}>
        <QuizPage />
      </AppProviders>,
    ),
  };
}

describe("QuizPage", () => {
  it("affiche une indisponibilité et aucune grille lorsque le quiz est désactivé", async () => {
    renderQuiz({ event: makeEvent({ quizEnabled: false }) });

    expect(await screen.findByRole("status")).toHaveTextContent(/quiz.*pas encore.*accessible/i);
    expect(screen.queryByRole("button", { name: /sortilèges/i })).not.toBeInTheDocument();
  });

  it("affiche exactement six thèmes et l’équipe issue de l’ordre figé", async () => {
    renderQuiz();

    expect(await screen.findAllByTestId("quiz-category")).toHaveLength(6);
    expect(screen.getByText(/au tour de l’équipe cerfs dorés/i)).toBeInTheDocument();
    expect(screen.queryByText(/au tour de l’équipe hiboux de givre/i)).not.toBeInTheDocument();
  });

  it("affiche un état terminé explicite après le passage de la dernière équipe", async () => {
    renderQuiz({
      quizSession: {
        id: "session-1", eventId: "event-1", teamOrder: ["team-c"], currentTeamIndex: 1,
        activeCategoryId: null, activeQuestionIndex: 0, answerVisible: false,
        revealedAnswer: null, startedAt: "2026-12-18T18:00:00Z",
      },
    });

    expect(await screen.findByRole("status")).toHaveTextContent(/quiz terminé/i);
    expect(screen.queryByText(/sera lancé par l.organisateur/i)).not.toBeInTheDocument();
  });

  it("rejette une URL de fond non HTTP et utilise le décor de secours", async () => {
    renderQuiz({
      categories: categories.map((category, index) => index === 0
        ? { ...category, imageUrl: "javascript:alert(document.domain)" }
        : category),
    });

    const firstCategory = (await screen.findAllByTestId("quiz-category"))[0];
    expect(firstCategory).toHaveClass("quiz-category--fallback");
    expect(firstCategory.style.getPropertyValue("--quiz-category-image")).toBe("");
    expect(firstCategory.getAttribute("style") ?? "").not.toContain("javascript:");
  });

  it("choisit un thème avec les identifiants nommés et navigue directement vers sa question", async () => {
    const user = userEvent.setup();
    const { repository } = renderQuiz();
    const choose = vi.spyOn(repository, "chooseQuizCategory").mockResolvedValue(undefined);

    await user.click(await screen.findByRole("button", { name: /sortilèges/i }));

    expect(choose).toHaveBeenCalledWith({
      eventId: "event-1",
      sessionId: "session-1",
      teamId: "team-c",
      categoryId: "category-1",
    });
    expect(await screen.findByText("Quel sort éclaire l’extrémité d’une baguette ?")).toBeInTheDocument();
  });

  it("désactive un thème joué et toutes les catégories après le choix de l’équipe", async () => {
    const initial = renderQuiz();

    expect(await screen.findByRole("button", { name: /cinéma/i })).toBeDisabled();
    initial.unmount();
    const chosenSnapshot = makeEventSnapshot({
      event: makeEvent({ quizEnabled: true }), teams,
      categories: categories.map((category) => category.id === "category-1"
        ? { ...category, chosenByTeamId: "team-c" }
        : category),
      questions,
      quizSession: {
        id: "session-1", eventId: "event-1", teamOrder: ["team-c", "team-a", "team-e", "team-d", "team-b"],
        currentTeamIndex: 0, activeCategoryId: null, activeQuestionIndex: 0,
        answerVisible: false, revealedAnswer: null, startedAt: "2026-12-18T18:00:00Z",
      },
    });
    const repository = new MemoryEventRepository(chosenSnapshot, {});
    render(
      <AppProviders repository={repository} eventSlug={EVENT_SLUG}><QuizPage /></AppProviders>,
    );
    const grid = await screen.findByRole("region", { name: /thèmes du quiz/i });
    expect(within(grid).getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("affiche la question et son barème fixe sans commandes organisateur", async () => {
    renderQuiz({
      quizSession: {
        id: "session-1", eventId: "event-1", teamOrder: ["team-c", "team-a", "team-e", "team-d", "team-b"],
        currentTeamIndex: 0, activeCategoryId: "category-1", activeQuestionIndex: 0,
        answerVisible: false, revealedAnswer: null, startedAt: "2026-12-18T18:00:00Z",
      },
    });

    expect(await screen.findByRole("heading", { name: "Quel sort éclaire l’extrémité d’une baguette ?" })).toBeInTheDocument();
    expect(screen.getByText("20 points")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /révéler|correct|incorrect/i })).not.toBeInTheDocument();
  });

  it("ne montre la réponse copiée que lorsque answerVisible est vrai", async () => {
    const hidden = renderQuiz({
      quizSession: {
        id: "session-1", eventId: "event-1", teamOrder: ["team-c"], currentTeamIndex: 0,
        activeCategoryId: "category-1", activeQuestionIndex: 0, answerVisible: false,
        revealedAnswer: "Lumos", startedAt: "2026-12-18T18:00:00Z",
      },
    });
    expect(await screen.findByText("20 points")).toBeInTheDocument();
    expect(screen.queryByText("Lumos")).not.toBeInTheDocument();
    hidden.unmount();

    renderQuiz({
      quizSession: {
        id: "session-1", eventId: "event-1", teamOrder: ["team-c"], currentTeamIndex: 0,
        activeCategoryId: "category-1", activeQuestionIndex: 0, answerVisible: true,
        revealedAnswer: "Lumos", startedAt: "2026-12-18T18:00:00Z",
      },
    });
    expect(await screen.findByText("Lumos")).toBeInTheDocument();
  });
});
