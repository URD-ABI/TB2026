import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { AdminParticipant } from "../../domain/types";
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
) {
  let emitSnapshot!: (snapshot: EventSnapshot) => void;
  const initial = makeEventSnapshot({ teams: [makeTeam()] });
  const repository = {
    cleanupPendingMedia,
    getAdminQuizQuestions: vi.fn().mockResolvedValue([]),
    getAdminParticipants,
    subscribe: vi.fn((_slug: string, listener: (snapshot: EventSnapshot) => void) => {
      emitSnapshot = listener;
      listener(initial);
      return vi.fn();
    }),
  } as unknown as EventRepository;
  return { repository, emit: (snapshot: EventSnapshot) => emitSnapshot(snapshot), initial };
}

function renderWorkspace(repository: EventRepository) {
  return render(
    <MemoryRouter initialEntries={["/admin/participants"]}>
      <AppProviders repository={repository} eventSlug="tournoi-des-arcanes">
        <AdminWorkspace />
      </AppProviders>
    </MemoryRouter>,
  );
}

describe("AdminWorkspace participant refresh", () => {
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
