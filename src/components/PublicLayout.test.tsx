import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../app/AppProviders";
import { MemoryEventRepository } from "../repositories/MemoryEventRepository";
import { makeEvent, makeEventSnapshot } from "../test/fixtures";
import { PublicLayout } from "./PublicLayout";

function renderPublicLayout({
  quizEnabled = false,
  backgroundUrl = null,
}: {
  quizEnabled?: boolean;
  backgroundUrl?: string | null;
} = {}) {
  const repository = new MemoryEventRepository(
    makeEventSnapshot({
      event: makeEvent({
        title: "Team Building 2026",
        subtitle: "Le tournoi des cinq équipes",
        quizEnabled,
        backgroundUrl,
      }),
    }),
    {},
  );
  const user = userEvent.setup();

  const view = render(
    <AppProviders repository={repository} eventSlug="tournoi-des-arcanes">
      <MemoryRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<h2>Page du classement</h2>} />
            <Route path="attribution" element={<h2>Page d’attribution</h2>} />
            <Route path="defis" element={<h2>Page des défis</h2>} />
            <Route path="quiz" element={<h2>Page du quiz</h2>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );

  return { ...view, repository, user };
}

describe("PublicLayout", () => {
  it("affiche le titre et le sous-titre configurés pour l’événement", async () => {
    renderPublicLayout();

    expect(await screen.findByRole("heading", { level: 1, name: "Team Building 2026" })).toBeInTheDocument();
    expect(screen.getByText("Le tournoi des cinq équipes")).toBeInTheDocument();
  });

  it("actualise le titre et le sous-titre lorsque la configuration change", async () => {
    const { repository } = renderPublicLayout();
    await screen.findByRole("heading", { level: 1, name: "Team Building 2026" });

    await act(() => repository.updateEvent(makeEvent({
      title: "Tournoi de Noël",
      subtitle: "La finale du Secret Santa",
      quizEnabled: false,
    })));

    expect(await screen.findByRole("heading", { level: 1, name: "Tournoi de Noël" })).toBeInTheDocument();
    expect(screen.getByText("La finale du Secret Santa")).toBeInTheDocument();
  });

  it("transmet le fond distant par variable CSS et ajoute un voile décoratif", async () => {
    const backgroundUrl = "https://project.supabase.co/storage/v1/object/public/event-media/fond.jpg";
    renderPublicLayout({ backgroundUrl });

    const shell = await screen.findByTestId("public-layout");
    expect(shell.style.getPropertyValue("--event-background")).toBe(`url("${backgroundUrl}")`);
    expect(shell.querySelector(".public-layout__veil")).toHaveAttribute("aria-hidden", "true");
  });

  it("propose les trois destinations publiques permanentes dans l’ordre prévu", async () => {
    renderPublicLayout({ quizEnabled: false });

    const navigation = await screen.findByRole("navigation", { name: /navigation principale/i });
    expect(within(navigation).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Classement",
      "Attribution",
      "Défis",
    ]);
  });

  it("cache le quiz tant qu’il n’est pas activé", async () => {
    renderPublicLayout({ quizEnabled: false });

    await screen.findByRole("navigation", { name: /navigation principale/i });
    expect(screen.queryByRole("link", { name: /quiz/i })).not.toBeInTheDocument();
  });

  it("affiche le quiz lorsqu’il est activé", async () => {
    renderPublicLayout({ quizEnabled: true });

    expect(await screen.findByRole("link", { name: /quiz/i })).toHaveAttribute("href", "/quiz");
  });

  it("permet d’atteindre les pages au clavier", async () => {
    const { user } = renderPublicLayout({ quizEnabled: true });
    const classement = await screen.findByRole("link", { name: "Classement" });

    await user.tab();
    expect(classement).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Attribution" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("heading", { level: 2, name: "Page d’attribution" })).toBeInTheDocument();
  });
});
