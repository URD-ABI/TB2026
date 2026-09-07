import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { EventRepository, EventSnapshot } from "../repositories/EventRepository";
import { makeEventSnapshot, makeTeam } from "../test/fixtures";
import { AppProviders, useEventContext } from "./AppProviders";

type ConnectionStatus = "online" | "reconnecting";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function makeRepository(initial: Promise<EventSnapshot>) {
  let snapshotListener: ((snapshot: EventSnapshot) => void) | undefined;
  let connectionListener: ((status: ConnectionStatus) => void) | undefined;
  const unsubscribe = vi.fn();
  const repository: EventRepository = {
    getSnapshot: vi.fn(() => initial),
    subscribe: vi.fn((
      _slug: string,
      listener: (snapshot: EventSnapshot) => void,
      onConnectionChange?: (status: ConnectionStatus) => void,
    ) => {
      snapshotListener = listener;
      connectionListener = onConnectionChange;
      return unsubscribe;
    }),
    updateEvent: vi.fn(), updateTeam: vi.fn(), revealParticipant: vi.fn(), applyScore: vi.fn(),
    chooseQuizCategory: vi.fn(),
  };
  return {
    repository,
    emitSnapshot: (snapshot: EventSnapshot) => snapshotListener?.(snapshot),
    emitStatus: (status: ConnectionStatus) => connectionListener?.(status),
    unsubscribe,
  };
}

function Probe() {
  const { snapshot, status, repository } = useEventContext();
  return (
    <div>
      <span>état:{status}</span>
      <span>équipe:{snapshot?.teams[0]?.name ?? "aucune"}</span>
      <span>dépôt:{repository ? "présent" : "absent"}</span>
    </div>
  );
}

describe("AppProviders", () => {
  it("utilise l'abonnement comme unique autorité de chargement initial", async () => {
    const staleRequest = deferred<EventSnapshot>();
    const fake = makeRepository(staleRequest.promise);
    render(<AppProviders repository={fake.repository} eventSlug="tournoi-des-arcanes"><Probe /></AppProviders>);

    expect(fake.repository.subscribe).toHaveBeenCalledOnce();
    expect(fake.repository.getSnapshot).not.toHaveBeenCalled();
    expect(screen.getByRole("status", { name: /chargement de l'événement/i })).toBeInTheDocument();

    act(() => fake.emitSnapshot(makeEventSnapshot({ teams: [makeTeam({ name: "Phénix" })] })));
    expect(await screen.findByText("équipe:Phénix")).toBeInTheDocument();

    await act(async () => staleRequest.resolve(makeEventSnapshot({ teams: [makeTeam({ name: "Ancienne" })] })));
    expect(screen.getByText("équipe:Phénix")).toBeInTheDocument();
  });

  it("affiche un chargement accessible jusqu'au premier instantané", async () => {
    const fake = makeRepository(Promise.resolve(makeEventSnapshot()));
    render(<AppProviders repository={fake.repository} eventSlug="tournoi-des-arcanes"><Probe /></AppProviders>);

    expect(screen.getByRole("status", { name: /chargement de l'événement/i })).toBeInTheDocument();
    expect(screen.queryByText(/dépôt:présent/i)).not.toBeInTheDocument();

    act(() => fake.emitSnapshot(makeEventSnapshot()));
    expect(await screen.findByText("équipe:Équipe A")).toBeInTheDocument();
  });

  it("expose l'instantané, l'état réseau et le dépôt aux pages enfants", async () => {
    const snapshot = makeEventSnapshot({ teams: [makeTeam({ name: "Hiboux" })] });
    const fake = makeRepository(Promise.resolve(snapshot));
    render(<AppProviders repository={fake.repository} eventSlug="tournoi-des-arcanes"><Probe /></AppProviders>);

    act(() => fake.emitSnapshot(snapshot));
    expect(await screen.findByText("équipe:Hiboux")).toBeInTheDocument();
    expect(screen.getByText("état:online")).toBeInTheDocument();
    expect(screen.getByText("dépôt:présent")).toBeInTheDocument();
  });

  it("conserve le dernier instantané pendant une reconnexion et affiche un bandeau", async () => {
    const snapshot = makeEventSnapshot({ teams: [makeTeam({ name: "Hiboux" })] });
    const fake = makeRepository(Promise.resolve(snapshot));
    render(<AppProviders repository={fake.repository} eventSlug="tournoi-des-arcanes"><Probe /></AppProviders>);
    act(() => fake.emitSnapshot(snapshot));
    expect(await screen.findByText("équipe:Hiboux")).toBeInTheDocument();

    act(() => fake.emitStatus("reconnecting"));

    expect(screen.getByText("équipe:Hiboux")).toBeInTheDocument();
    expect(screen.getByText("état:reconnecting")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /connexion interrompue/i })).toBeInTheDocument();
  });

  it("remplace l'instantané après une mise à jour temps réel", async () => {
    const fake = makeRepository(Promise.resolve(makeEventSnapshot()));
    render(<AppProviders repository={fake.repository} eventSlug="tournoi-des-arcanes"><Probe /></AppProviders>);
    act(() => fake.emitSnapshot(makeEventSnapshot()));
    expect(await screen.findByText("équipe:Équipe A")).toBeInTheDocument();

    act(() => fake.emitSnapshot(makeEventSnapshot({ teams: [makeTeam({ name: "Dragons" })] })));
    expect(screen.getByText("équipe:Dragons")).toBeInTheDocument();
  });

  it("désabonne le temps réel au démontage", async () => {
    const fake = makeRepository(Promise.resolve(makeEventSnapshot()));
    const view = render(<AppProviders repository={fake.repository} eventSlug="tournoi-des-arcanes"><Probe /></AppProviders>);
    act(() => fake.emitSnapshot(makeEventSnapshot()));
    expect(await screen.findByText("équipe:Équipe A")).toBeInTheDocument();

    view.unmount();
    expect(fake.unsubscribe).toHaveBeenCalledOnce();
  });
});
