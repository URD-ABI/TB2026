import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppProviders } from "./AppProviders";
import { MemoryEventRepository } from "../repositories/MemoryEventRepository";
import { makeEvent, makeEventSnapshot } from "../test/fixtures";
import { App } from "./App";

function renderApp(path: string) {
  window.history.pushState({}, "", path);
  const repository = new MemoryEventRepository(
    makeEventSnapshot({
      event: makeEvent({ title: "Team Building 2026", subtitle: "Le tournoi des cinq équipes" }),
    }),
    {},
  );

  return render(
    <AppProviders repository={repository} eventSlug="tournoi-des-arcanes">
      <App basename="/tb2026/" />
    </AppProviders>,
  );
}

describe("App", () => {
  afterEach(() => window.history.pushState({}, "", "/"));

  it("respecte le basename GitHub Pages pour les routes publiques", async () => {
    renderApp("/tb2026/defis");

    expect(await screen.findByRole("heading", { name: "Défis" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Attribution" })).toHaveAttribute("href", "/tb2026/attribution");
  });

  it("réserve la route d’administration hors de la coque publique", async () => {
    renderApp("/tb2026/admin");

    expect(await screen.findByRole("heading", { name: "Administration" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /navigation principale/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Team Building 2026" })).not.toBeInTheDocument();
  });
});
