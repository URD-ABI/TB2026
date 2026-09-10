import { act } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { Participant, Team } from "../../domain/types";
import { MemoryEventRepository } from "../../repositories/MemoryEventRepository";
import { makeEventSnapshot, makeParticipant, makeTeam } from "../../test/fixtures";
import { AssignmentPage } from "./AssignmentPage";

const EVENT_SLUG = "tournoi-des-arcanes";

function fiveTeams(): Team[] {
  return [
    makeTeam({ id: "team-a", name: "Lynx d’argent", emblem: "L", displayOrder: 0 }),
    makeTeam({ id: "team-b", name: "Hiboux de givre", emblem: "H", displayOrder: 1 }),
    makeTeam({ id: "team-c", name: "Cerfs dorés", emblem: "C", displayOrder: 2 }),
    makeTeam({ id: "team-d", name: "Renards de braise", emblem: "R", displayOrder: 3 }),
    makeTeam({ id: "team-e", name: "Loups des mers", emblem: "M", displayOrder: 4 }),
  ];
}

function waitingParticipants(): Participant[] {
  return [
    makeParticipant({ id: "participant-3", name: "Chloé Martin", photoUrl: "https://example.test/chloe.jpg", revealOrder: 3 }),
    makeParticipant({ id: "participant-1", name: "Alice Durand", photoUrl: "https://example.test/alice.jpg", revealOrder: 1 }),
    makeParticipant({ id: "participant-2", name: "Benoît Leroy", photoUrl: null, revealOrder: 2 }),
  ];
}

function renderAssignment(options: {
  participants?: Participant[];
  assignments?: Record<string, string>;
} = {}) {
  const teams = fiveTeams();
  const participants = options.participants ?? waitingParticipants();
  const repository = new MemoryEventRepository(
    makeEventSnapshot({ teams, participants }),
    options.assignments ?? {
      "participant-1": "team-e",
      "participant-2": "team-b",
      "participant-3": "team-c",
    },
  );
  const view = render(
    <AppProviders repository={repository} eventSlug={EVENT_SLUG}>
      <AssignmentPage />
    </AppProviders>,
  );
  return { ...view, repository, teams, participants };
}

async function flushInitialSnapshot() {
  await act(async () => undefined);
}

async function finishCeremony() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

describe("AssignmentPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("présente le premier participant non révélé, sa photo puis le bouton de tirage", async () => {
    renderAssignment();
    await flushInitialSnapshot();

    expect(screen.getByRole("heading", { level: 1, name: /attribution des équipes/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alice Durand" })).toBeInTheDocument();
    expect(screen.queryByText("Chloé Martin")).not.toBeInTheDocument();

    const portrait = screen.getByRole("img", { name: "Portrait de Alice Durand" });
    const launchButton = screen.getByRole("button", { name: /lancer.*attribution/i });
    expect(portrait).toHaveAttribute("src", "https://example.test/alice.jpg");
    expect(portrait.compareDocumentPosition(launchButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("affiche exactement les cinq équipes dans la roue et dans les compositions", async () => {
    const { teams } = renderAssignment();
    await flushInitialSnapshot();

    const reel = screen.getByRole("list", { name: /roue des équipes/i });
    const compositions = screen.getByRole("region", { name: /composition des équipes/i });
    expect(within(reel).getAllByTestId("reel-team")).toHaveLength(5);
    expect(within(compositions).getAllByTestId("team-composition")).toHaveLength(5);
    for (const team of teams) {
      expect(within(reel).getByText(team.name)).toHaveClass("team-reel__name");
      expect(within(compositions).getByRole("heading", { name: team.name })).toHaveClass("team-composition__name");
      expect(within(reel).queryByText(team.emblem)).not.toBeInTheDocument();
      expect(within(compositions).queryByText(team.emblem)).not.toBeInTheDocument();
    }
  });

  it("annonce la formule, parcourt les cinq équipes et termine sur l’équipe renvoyée par le dépôt", async () => {
    const { repository } = renderAssignment();
    const reveal = vi.spyOn(repository, "revealParticipant");
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    expect(screen.getByText("Pique-nique-douille, c’est toi l’andouille")).toBeInTheDocument();
    expect(reveal).toHaveBeenCalledExactlyOnceWith("event-1", "participant-1");

    await finishCeremony();

    const reelTeams = screen.getAllByTestId("reel-team");
    expect(reelTeams).toHaveLength(5);
    for (const team of reelTeams) expect(team).toHaveAttribute("data-visited", "true");
    expect(screen.getByTestId("assignment-result")).toHaveTextContent("Loups des mers");
    expect(within(screen.getByRole("list", { name: /roue des équipes/i })).getByText("Loups des mers").closest("[data-testid='reel-team']"))
      .toHaveAttribute("aria-current", "true");
  });

  it("bloque les doubles clics et n’effectue qu’une révélation atomique", async () => {
    const { repository } = renderAssignment();
    let resolveReveal!: (value: { participantId: string; teamId: string }) => void;
    const pendingReveal = new Promise<{ participantId: string; teamId: string }>((resolve) => { resolveReveal = resolve; });
    const reveal = vi.spyOn(repository, "revealParticipant").mockReturnValue(pendingReveal);
    await flushInitialSnapshot();

    const launchButton = screen.getByRole("button", { name: /lancer.*attribution/i });
    fireEvent.click(launchButton);
    fireEvent.click(launchButton);

    expect(launchButton).toBeDisabled();
    expect(reveal).toHaveBeenCalledTimes(1);

    resolveReveal({ participantId: "participant-1", teamId: "team-e" });
    await finishCeremony();
    expect(reveal).toHaveBeenCalledTimes(1);
  });

  it("permet de réessayer après une erreur sans afficher de fausse attribution", async () => {
    const { repository } = renderAssignment();
    const originalReveal = repository.revealParticipant.bind(repository);
    const reveal = vi.spyOn(repository, "revealParticipant")
      .mockRejectedValueOnce(new Error("network_error"))
      .mockImplementation(originalReveal);
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    expect(screen.getByRole("alert")).toHaveTextContent(/impossible.*réessayer/i);
    expect(screen.queryByTestId("assignment-result")).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Alice Durand — Loups des mers" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));
    await finishCeremony();

    expect(reveal).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("assignment-result")).toHaveTextContent("Loups des mers");
  });

  it("glisse automatiquement le portrait révélé dans la bonne composition", async () => {
    renderAssignment();
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    const loups = screen.getByRole("article", { name: "Composition Loups des mers" });
    expect(within(loups).getByRole("img", { name: "Alice Durand — Loups des mers" })).toHaveAttribute(
      "src",
      "https://example.test/alice.jpg",
    );
    expect(within(loups).getByRole("img", { name: "Alice Durand — Loups des mers" })).toHaveClass("participant-token--new");
    expect(screen.getByRole("heading", { name: "Benoît Leroy" })).toBeInTheDocument();
  });

  it("révèle le résultat dans un dialogue plein écran avant de présenter le participant suivant", async () => {
    renderAssignment();
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    const resultOverlay = screen.getByRole("dialog", { name: /attribution de Alice Durand/i });
    expect(resultOverlay).toHaveAttribute("aria-modal", "true");
    expect(resultOverlay).toHaveClass("assignment-result-overlay");
    expect(within(resultOverlay).getByText("Alice Durand")).toBeInTheDocument();
    expect(within(resultOverlay).getByText("Loups des mers")).toHaveClass("assignment-result-overlay__team-name");
    expect(within(resultOverlay).queryByText("M")).not.toBeInTheDocument();
    expect(within(resultOverlay).queryByText("Benoît Leroy")).not.toBeInTheDocument();

    fireEvent.click(within(resultOverlay).getByRole("button", { name: /participant suivant/i }));

    expect(screen.queryByRole("dialog", { name: /attribution de Alice Durand/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Benoît Leroy" })).toBeInTheDocument();
  });

  it("conserve brièvement l’animation du portrait dans la composition après la fermeture du résultat", async () => {
    renderAssignment();
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    const resultOverlay = screen.getByRole("dialog", { name: /attribution de Alice Durand/i });
    fireEvent.click(within(resultOverlay).getByRole("button", { name: /participant suivant/i }));

    const loups = screen.getByRole("article", { name: "Composition Loups des mers" });
    const portrait = within(loups).getByRole("img", { name: "Alice Durand — Loups des mers" });
    expect(portrait).toHaveClass("participant-token--new");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(portrait).not.toHaveClass("participant-token--new");
  });

  it("avance localement lorsque la révélation réussit avant le prochain instantané temps réel", async () => {
    const { repository } = renderAssignment();
    const reveal = vi.spyOn(repository, "revealParticipant")
      .mockResolvedValueOnce({ participantId: "participant-1", teamId: "team-e" })
      .mockResolvedValueOnce({ participantId: "participant-2", teamId: "team-b" });
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    const loups = screen.getByRole("article", { name: "Composition Loups des mers" });
    expect(within(loups).getByRole("img", { name: "Alice Durand — Loups des mers" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /participant suivant/i }));
    expect(screen.getByRole("heading", { name: "Benoît Leroy" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    expect(reveal).toHaveBeenNthCalledWith(1, "event-1", "participant-1");
    expect(reveal).toHaveBeenNthCalledWith(2, "event-1", "participant-2");
  });

  it("isole la scène et confine le focus dans le dialogue avant de le rendre au tirage suivant", async () => {
    renderAssignment();
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    const scene = screen.getByTestId("assignment-scene");
    const dialog = screen.getByRole("dialog", { name: /attribution de Alice Durand/i });
    const nextButton = within(dialog).getByRole("button", { name: /participant suivant/i });
    expect(scene).toHaveAttribute("inert");
    expect(nextButton).toHaveFocus();

    fireEvent.keyDown(nextButton, { key: "Tab" });
    expect(nextButton).toHaveFocus();
    fireEvent.keyDown(nextButton, { key: "Tab", shiftKey: true });
    expect(nextButton).toHaveFocus();

    fireEvent.click(nextButton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lancer.*attribution/i })).toHaveFocus();
  });

  it("affiche les initiales des participants sans image dans leur équipe", async () => {
    renderAssignment({
      participants: [
        makeParticipant({
          id: "participant-2",
          name: "Benoît Leroy",
          photoUrl: null,
          revealOrder: 2,
          revealedAt: "2026-12-01T10:00:00Z",
          revealedTeamId: "team-b",
        }),
        makeParticipant({ id: "participant-3", name: "Chloé Martin", revealOrder: 3 }),
      ],
    });
    await flushInitialSnapshot();

    const hiboux = screen.getByRole("article", { name: "Composition Hiboux de givre" });
    const fallback = within(hiboux).getByLabelText("Benoît Leroy — Hiboux de givre");
    expect(fallback).toHaveTextContent(/^BL$/);
    expect(fallback).toHaveClass("participant-token--initials");
  });

  it("affiche un état final lorsque tous les participants sont attribués", async () => {
    renderAssignment({
      participants: [
        makeParticipant({
          id: "participant-1",
          name: "Alice Durand",
          revealedAt: "2026-12-01T10:00:00Z",
          revealedTeamId: "team-a",
        }),
      ],
    });
    await flushInitialSnapshot();

    expect(screen.getByRole("status")).toHaveTextContent(/tous les participants.*attribués/i);
    expect(screen.queryByRole("button", { name: /attribution|réessayer/i })).not.toBeInTheDocument();
  });

  it("supprime l’animation d’arrivée quand les mouvements réduits sont préférés", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderAssignment();
    await flushInitialSnapshot();

    fireEvent.click(screen.getByRole("button", { name: /lancer.*attribution/i }));
    await finishCeremony();

    const loups = screen.getByRole("article", { name: "Composition Loups des mers" });
    expect(within(loups).getByRole("img", { name: "Alice Durand — Loups des mers" }))
      .not.toHaveClass("participant-token--new");
    expect(screen.getByTestId("team-reel")).toHaveAttribute("data-motion", "reduced");
  });
});
