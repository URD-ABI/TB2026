import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { QuizCategory, QuizChoice, QuizQuestion, QuizSession, Team } from "../../domain/types";
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

const choices: QuizChoice[] = [
  { id: "choice-a", questionId: "question-1", text: "Une baguette", displayOrder: 0 },
  { id: "choice-b", questionId: "question-1", text: "Un médaillon", displayOrder: 1 },
  { id: "choice-c", questionId: "question-1", text: "Une clé", displayOrder: 2 },
  { id: "choice-d", questionId: "question-1", text: "Un grimoire", displayOrder: 3 },
];

function makeQuizSession(overrides: Partial<QuizSession> = {}): QuizSession {
  return {
    id: "session-1",
    eventId: "event-1",
    teamOrder: ["team-c", "team-a", "team-e", "team-d", "team-b"],
    currentTeamIndex: 0,
    activeCategoryId: null,
    activeQuestionIndex: 0,
    selectedChoiceId: null,
    choiceLocked: false,
    answerVisible: false,
    revealedChoiceId: null,
    startedAt: "2026-12-18T18:00:00Z",
    ...overrides,
  };
}

function renderQuiz(overrides: Partial<EventSnapshot> = {}) {
  const snapshot = makeEventSnapshot({
    event: makeEvent({ quizEnabled: true }),
    teams,
    categories,
    questions,
    choices,
    quizSession: makeQuizSession(),
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
      quizSession: makeQuizSession({ teamOrder: ["team-c"], currentTeamIndex: 1 }),
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

    const playedButton = await screen.findByRole("button", { name: /cinéma/i });
    const playedCard = playedButton.closest("[data-testid='quiz-category']");
    expect(playedButton).toBeDisabled();
    expect(playedCard).toHaveClass("quiz-category--played");
    expect(within(playedCard as HTMLElement).getByText("Thème terminé")).toBeInTheDocument();
    expect(within(playedCard as HTMLElement).getByTestId("quiz-category-complete")).toHaveTextContent("✓");
    initial.unmount();
    const chosenSnapshot = makeEventSnapshot({
      event: makeEvent({ quizEnabled: true }), teams,
      categories: categories.map((category) => category.id === "category-1"
        ? { ...category, chosenByTeamId: "team-c" }
        : category),
      questions, choices,
      quizSession: makeQuizSession(),
    });
    const repository = new MemoryEventRepository(chosenSnapshot, {});
    render(
      <AppProviders repository={repository} eventSlug={EVENT_SLUG}><QuizPage /></AppProviders>,
    );
    const grid = await screen.findByRole("region", { name: /thèmes du quiz/i });
    const inProgressButton = within(grid).getByRole("button", { name: /sortilèges/i });
    const inProgressCard = inProgressButton.closest("[data-testid='quiz-category']");
    expect(within(grid).getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(within(inProgressCard as HTMLElement).getByText("Thème en cours")).toBeInTheDocument();
    expect(inProgressCard).not.toHaveClass("quiz-category--played");
  });

  it("affiche la question et son barème fixe sans commandes organisateur", async () => {
    renderQuiz({
      quizSession: makeQuizSession({ activeCategoryId: "category-1" }),
    });

    expect(await screen.findByRole("heading", { name: "Quel sort éclaire l’extrémité d’une baguette ?" })).toBeInTheDocument();
    expect(screen.getByText("20 points")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /révéler|correct|incorrect/i })).not.toBeInTheDocument();
  });

  it("enregistre la réponse choisie par l’équipe", async () => {
    const user = userEvent.setup();
    const { repository } = renderQuiz({ quizSession: makeQuizSession({ activeCategoryId: "category-1" }) });
    const select = vi.spyOn(repository, "selectQuizChoice").mockResolvedValue(undefined);

    await user.click(await screen.findByRole("button", { name: "B — Un médaillon" }));

    expect(select).toHaveBeenCalledWith("session-1", "question-1", "choice-b");
  });

  it("désactive les réponses lorsque le choix est verrouillé", async () => {
    renderQuiz({ quizSession: makeQuizSession({ activeCategoryId: "category-1", selectedChoiceId: "choice-b", choiceLocked: true }) });

    expect(await screen.findByRole("button", { name: "B — Un médaillon" })).toBeDisabled();
    expect(screen.getByText("Choix verrouillé")).toBeInTheDocument();
  });

  it("affiche une mauvaise réponse en rouge et la bonne en vert après révélation", async () => {
    renderQuiz({
      quizSession: makeQuizSession({
        activeCategoryId: "category-1",
        selectedChoiceId: "choice-b",
        choiceLocked: true,
        answerVisible: true,
        revealedChoiceId: "choice-c",
      }),
    });

    expect(await screen.findByRole("button", { name: "B — Un médaillon" })).toHaveClass("question-choice--wrong");
    expect(screen.getByRole("button", { name: "C — Une clé" })).toHaveClass("question-choice--correct");
  });

  it("ne révèle pas la bonne réponse avant l’action de l’administrateur", async () => {
    const hidden = renderQuiz({
      quizSession: makeQuizSession({ activeCategoryId: "category-1", selectedChoiceId: "choice-c" }),
    });
    const selectedBeforeReveal = await screen.findByRole("button", { name: "C — Une clé" });
    expect(selectedBeforeReveal).toHaveClass("question-choice--selected");
    expect(selectedBeforeReveal).not.toHaveClass("question-choice--correct");
    hidden.unmount();

    renderQuiz({
      quizSession: makeQuizSession({
        activeCategoryId: "category-1",
        selectedChoiceId: "choice-c",
        choiceLocked: true,
        answerVisible: true,
        revealedChoiceId: "choice-c",
      }),
    });
    expect(await screen.findByRole("button", { name: "C — Une clé" })).toHaveClass("question-choice--correct");
  });
});
