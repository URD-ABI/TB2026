import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppProviders } from "./AppProviders";
import { MemoryEventRepository } from "../repositories/MemoryEventRepository";
import { makeEvent, makeEventSnapshot } from "../test/fixtures";
import type { Challenge } from "../domain/types";
import { App } from "./App";
import type { AdminClient } from "../features/admin/useAdminSession";

function renderApp(path: string, challenges: Challenge[] = [], adminAuth?: AdminClient) {
  window.history.pushState({}, "", path);
  const repository = new MemoryEventRepository(
    makeEventSnapshot({
      event: makeEvent({ title: "Team Building 2026", subtitle: "Le tournoi des cinq équipes" }),
      challenges,
    }),
    {},
  );

  return render(
    <AppProviders repository={repository} eventSlug="tournoi-des-arcanes">
      <App basename="/tb2026/" adminAuth={adminAuth} />
    </AppProviders>,
  );
}

describe("App", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

  it("respecte le basename GitHub Pages pour les routes publiques", async () => {
    renderApp("/tb2026/defis", [{
      id: "challenge-route",
      eventId: "event-1",
      title: "Le défi venu du contexte",
      kind: "Mystère",
      description: "Cette carte prouve que la route utilise la mosaïque connectée.",
      imageUrl: null,
      displayOrder: 0,
    }]);

    expect(await screen.findByRole("heading", { name: "Les cinq défis" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Le défi venu du contexte" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attribution" })).toHaveAttribute("href", "/tb2026/attribution");
  });

  it("réserve la route d’administration hors de la coque publique", async () => {
    const adminAuth = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    } as unknown as AdminClient;
    renderApp("/tb2026/admin", [], adminAuth);

    expect(await screen.findByRole("button", { name: /se connecter/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /navigation principale/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Team Building 2026" })).not.toBeInTheDocument();
  });

  it("rend les éditeurs d’administration dans la route imbriquée de l’application", async () => {
    const adminAuth = {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "admin-1" } } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ data: { session: null, user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: { user_id: "admin-1" }, error: null }) }),
        }),
      }),
    } as unknown as AdminClient;

    renderApp("/tb2026/admin/equipes", [], adminAuth);

    expect(await screen.findByRole("heading", { name: /équipes et scores/i })).toBeInTheDocument();
  });
});
