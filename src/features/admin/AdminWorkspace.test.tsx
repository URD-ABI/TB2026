import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { AdminParticipant, QuizCategory, QuizChoice, QuizQuestion, QuizSession } from "../../domain/types";
import type { EventRepository, EventSnapshot } from "../../repositories/EventRepository";
import { makeEventSnapshot, makeParticipant, makeTeam } from "../../test/fixtures";
import { AdminWorkspace } from "./AdminApp";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, reject, resolve };
}

function adminParticipant(id: string, name: string): AdminParticipant {
  return { ...makeParticipant({ id, name }), assignedTeamId: "team-a" };
}

function makeWorkspaceRepository(
  getAdminParticipants: EventRepository["getAdminParticipants"],
  cleanupPendingMedia: EventRepository["cleanupPendingMedia"] = vi.fn().mockResolvedValue(undefined),
  snapshotOverrides: Partial<EventSnapshot> = {},
) {
  let emitSnapshot!: (snapshot: EventSnapshot) => void;
  const initial = makeEventSnapshot({ teams: [makeTeam()], ...snapshotOverrides });
  const repository = {
    cleanupPendingMedia,
    getAdminQuizQuestions: vi.fn().mockResolvedValue([]),
    getScoreHistory: vi.fn().mockResolvedValue([]),
    getAdminParticipants,
    lockQuizChoice: vi.fn().mockResolvedValue(undefined),
    revealAndScoreQuizAnswer: vi.fn().mockResolvedValue(undefined),
    advanceQuizQuestion: vi.fn().mockResolvedValue(undefined),
    resetQuiz: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn((_slug: string, listener: (snapshot: EventSnapshot) => void) => {
      emitSnapshot = listener;
      listener(initial);
      return vi.fn();
    }),
  } as unknown as EventRepository;
  return { repository, emit: (snapshot: EventSnapshot) => emitSnapshot(snapshot), initial };
}

function renderWorkspace(repository: EventRepository, path = "/admin/participants") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders repository={repository} eventSlug="tournoi-des-arcanes">
        <Routes>
          <Route path="/admin/*" element={<AdminWorkspace />} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("AdminWorkspace participant refresh", () => {
  it("raccorde la réinitialisation du quiz au dépôt", async () => {
    const user = userEvent.setup();
    const fake = makeWorkspaceRepository(vi.fn().mockResolvedValue([]));
    renderWorkspace(fake.repository, "/admin/quiz");

    await user.click(await screen.findByRole("button", { name: /^réinitialiser le quiz$/i }));
    await user.click(screen.getByRole("button", { name: /confirmer la réinitialisation/i }));

    expect(fake.repository.resetQuiz).toHaveBeenCalledWith(fake.initial.event.id);
  });

  it("raccorde le verrouillage du choix au dépôt", async () => {
    const user = userEvent.setup();
    const quizCategory: QuizCategory = { id: "category-1", eventId: "event-1", title: "Hiver", imageUrl: null, displayOrder: 0, status: "available", chosenByTeamId: null };
    const quizQuestion: QuizQuestion = { id: "question-1", categoryId: "category-1", prompt: "Question ?", points: 10, displayOrder: 0 };
    const quizChoices: QuizChoice[] = [
      { id: "choice-a", questionId: "question-1", text: "A", displayOrder: 0 },
      { id: "choice-b", questionId: "question-1", text: "B", displayOrder: 1 },
      { id: "choice-c", questionId: "question-1", text: "C", displayOrder: 2 },
      { id: "choice-d", questionId: "question-1", text: "D", displayOrder: 3 },
    ];
    const quizSession: QuizSession = {
      id: "session-1", eventId: "event-1", teamOrder: ["team-a"], currentTeamIndex: 0,
      activeCategoryId: "category-1", activeQuestionIndex: 0, selectedChoiceId: "choice-b",
      choiceLocked: false, answerVisible: false, revealedChoiceId: null, startedAt: "2026-12-18T10:00:00Z",
    };
    const fake = makeWorkspaceRepository(vi.fn().mockResolvedValue([]), undefined, {
      categories: [quizCategory], questions: [quizQuestion], choices: quizChoices, quizSession,
    });
    renderWorkspace(fake.repository, "/admin/quiz");

    await user.click(await screen.findByRole("button", { name: "Verrouiller le choix" }));

    expect(fake.repository.lockQuizChoice).toHaveBeenCalledWith("session-1", "question-1");
  });

  it("ignore une réponse obsolète arrivée après le rafraîchissement le plus récent", async () => {
    const oldRequest = deferred<AdminParticipant[]>();
    const currentRequest = deferred<AdminParticipant[]>();
    const getAdminParticipants = vi.fn()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(currentRequest.promise);
    const fake = makeWorkspaceRepository(getAdminParticipants);
    renderWorkspace(fake.repository);
    await vi.waitFor(() => expect(getAdminParticipants).toHaveBeenCalledOnce());

    act(() => fake.emit({ ...fake.initial, participants: [makeParticipant({ id: "changed" })] }));
    await vi.waitFor(() => expect(getAdminParticipants).toHaveBeenCalledTimes(2));
    await act(async () => currentRequest.resolve([adminParticipant("p-current", "Benoît")]));
    expect(await screen.findByRole("group", { name: "Benoît" })).toBeInTheDocument();

    await act(async () => oldRequest.resolve([adminParticipant("p-old", "Alice")]));
    expect(screen.getByRole("group", { name: "Benoît" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Alice" })).not.toBeInTheDocument();
  });

  it("conserve la dernière liste et affiche une erreur générique si un rafraîchissement échoue", async () => {
    const getAdminParticipants = vi.fn()
      .mockResolvedValueOnce([adminParticipant("p-current", "Alice")])
      .mockRejectedValueOnce(new Error("JWT expired for admin@example.fr"));
    const fake = makeWorkspaceRepository(getAdminParticipants);
    renderWorkspace(fake.repository);
    expect(await screen.findByRole("group", { name: "Alice" })).toBeInTheDocument();

    act(() => fake.emit({ ...fake.initial, participants: [makeParticipant({ id: "changed" })] }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/chargement des participants impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/jwt|admin@example\.fr/i);
    expect(screen.getByRole("group", { name: "Alice" })).toBeInTheDocument();
  });

  it("reprend le nettoyage durable au chargement et permet de le relancer", async () => {
    const user = userEvent.setup();
    const cleanupPendingMedia = vi.fn()
      .mockRejectedValueOnce(new Error("storage token leaked"))
      .mockResolvedValueOnce(undefined);
    const fake = makeWorkspaceRepository(vi.fn().mockResolvedValue([]), cleanupPendingMedia);

    renderWorkspace(fake.repository);

    expect(await screen.findByRole("alert")).toHaveTextContent(/nettoyage des médias impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/storage token/i);
    await user.click(screen.getByRole("button", { name: /réessayer le nettoyage/i }));
    await vi.waitFor(() => expect(cleanupPendingMedia).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/nettoyage des médias impossible/i)).not.toBeInTheDocument();
  });
});
