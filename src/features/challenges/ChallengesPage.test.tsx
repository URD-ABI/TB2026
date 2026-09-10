import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { Challenge } from "../../domain/types";
import { MemoryEventRepository } from "../../repositories/MemoryEventRepository";
import { makeEventSnapshot } from "../../test/fixtures";
import { ChallengesPage } from "./ChallengesPage";

const EVENT_SLUG = "tournoi-des-arcanes";

function challenge(overrides: Partial<Challenge>): Challenge {
  return {
    id: "challenge-1",
    eventId: "event-1",
    title: "La clé des glaces",
    kind: "Adresse",
    description: "Rapportez la clé avant que le sablier ne soit vide.",
    imageUrl: "https://example.test/images/cle-des-glaces.webp",
    displayOrder: 0,
    ...overrides,
  };
}

function fiveChallenges(): Challenge[] {
  return [
    challenge({ id: "challenge-5", title: "Le banquet secret", kind: "Finale", description: "Déchiffrez le dernier message.", displayOrder: 4 }),
    challenge({ id: "challenge-2", title: "Les remparts givrés", kind: "Agilité", description: "Traversez les remparts sans réveiller le gardien.", imageUrl: null, displayOrder: 1 }),
    challenge({ id: "challenge-4", title: "La salle des énigmes", kind: "Réflexion", description: "Résolvez ensemble le mécanisme ancien.", displayOrder: 3 }),
    challenge({ id: "challenge-1", title: "La clé des glaces", kind: "Adresse", description: "Rapportez la clé avant que le sablier ne soit vide.", imageUrl: "https://example.test/images/cle-des-glaces.webp", displayOrder: 0 }),
    challenge({ id: "challenge-3", title: "Le relais des hiboux", kind: "Vitesse", description: "Transmettez le message à toute l’équipe.", displayOrder: 2 }),
  ];
}

function renderChallenges(challenges = fiveChallenges()) {
  const repository = new MemoryEventRepository(makeEventSnapshot({ challenges }), {});
  return render(
    <AppProviders repository={repository} eventSlug={EVENT_SLUG}>
      <ChallengesPage />
    </AppProviders>,
  );
}

describe("ChallengesPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("affiche uniquement le premier défi trié et cinq indicateurs ordonnés", async () => {
    renderChallenges();

    const tiles = await screen.findAllByTestId("challenge-tile");
    expect(tiles).toHaveLength(1);
    expect(within(tiles[0]).getByRole("heading", { level: 2 })).toHaveTextContent("La clé des glaces");
    expect(screen.getAllByRole("button", { name: /afficher le défi/i }).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Afficher le défi 1 : La clé des glaces",
      "Afficher le défi 2 : Les remparts givrés",
      "Afficher le défi 3 : Le relais des hiboux",
      "Afficher le défi 4 : La salle des énigmes",
      "Afficher le défi 5 : Le banquet secret",
    ]);
  });

  it("navigue avec les commandes et boucle dans les deux sens", async () => {
    const user = userEvent.setup();
    renderChallenges();

    await screen.findByRole("heading", { name: "La clé des glaces" });
    await user.click(screen.getByRole("button", { name: /défi précédent/i }));
    expect(screen.getByRole("heading", { name: "Le banquet secret" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /défi suivant/i }));
    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Afficher le défi 3 : Le relais des hiboux" }));
    expect(screen.getByRole("heading", { name: "Le relais des hiboux" })).toBeInTheDocument();
  });

  it("masque les commandes avec un seul défi et affiche un état vide", async () => {
    const { unmount } = renderChallenges([challenge({})]);
    expect(await screen.findByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /défi|carrousel/i })).not.toBeInTheDocument();

    unmount();
    renderChallenges([]);
    expect(await screen.findByText("Aucun défi n’est encore disponible.")).toBeInTheDocument();
    expect(screen.queryByTestId("challenge-tile")).not.toBeInTheDocument();
  });

  it("avance automatiquement toutes les 7 secondes et boucle", async () => {
    vi.useFakeTimers();
    renderChallenges();
    await act(async () => undefined);

    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(28_000));
    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
  });

  it("permet de mettre en pause puis de relancer le carrousel", async () => {
    vi.useFakeTimers();
    renderChallenges();
    await act(async () => undefined);

    fireEvent.click(screen.getByRole("button", { name: "Mettre le carrousel en pause" }));
    await act(async () => vi.advanceTimersByTimeAsync(14_000));
    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Relancer le carrousel" }));
    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
  });

  it("suspend l’automatisme au survol et au focus d’un contrôle", async () => {
    vi.useFakeTimers();
    renderChallenges();
    await act(async () => undefined);
    const carousel = screen.getByRole("region", { name: "Carrousel des défis" });

    fireEvent.mouseEnter(carousel);
    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    fireEvent.mouseLeave(carousel);
    fireEvent.focus(screen.getByRole("button", { name: "Défi suivant" }));
    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    fireEvent.blur(screen.getByRole("button", { name: "Défi suivant" }), { relatedTarget: document.body });
    await act(async () => vi.advanceTimersByTimeAsync(7_000));
    expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
  });

  it("navigue au clavier et réinitialise le délai après une commande manuelle", async () => {
    vi.useFakeTimers();
    renderChallenges();
    await act(async () => undefined);
    const carousel = screen.getByRole("region", { name: "Carrousel des défis" });

    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    fireEvent.keyDown(carousel, { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(6_000));
    expect(screen.getByRole("heading", { name: "Le relais des hiboux" })).toBeInTheDocument();
    fireEvent.keyDown(carousel, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "Les remparts givrés" })).toBeInTheDocument();
  });

  it("démarre en pause sans transition quand les mouvements réduits sont préférés", async () => {
    vi.useFakeTimers();
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
    renderChallenges();
    await act(async () => undefined);

    expect(screen.getByRole("region", { name: "Carrousel des défis" })).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByRole("button", { name: "Relancer le carrousel" })).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(14_000));
    expect(screen.getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
  });

  it("affiche pour chaque tuile un numéro sur deux chiffres, le type, le titre et la description", async () => {
    renderChallenges();

    const tile = await screen.findByTestId("challenge-tile");
    expect(within(tile).getByTestId("challenge-number")).toHaveTextContent("01");
    expect(within(tile).getByText("Adresse")).toBeInTheDocument();
    expect(within(tile).getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    expect(within(tile).getByText("Rapportez la clé avant que le sablier ne soit vide.")).toBeInTheDocument();
  });

  it("applique l’image distante comme fond sans l’injecter dans le contenu HTML", async () => {
    renderChallenges();

    const firstTile = (await screen.findAllByTestId("challenge-tile"))[0];
    expect(firstTile.style.getPropertyValue("--challenge-image")).toBe(
      'url("https://example.test/images/cle-des-glaces.webp")',
    );
    expect(within(firstTile).queryByRole("img")).not.toBeInTheDocument();
  });

  it("utilise un décor magique non informatif lorsqu’un défi n’a pas d’image", async () => {
    const user = userEvent.setup();
    renderChallenges();

    await screen.findByRole("heading", { name: "La clé des glaces" });
    await user.click(screen.getByRole("button", { name: "Afficher le défi 2 : Les remparts givrés" }));
    const fallbackTile = screen.getByTestId("challenge-tile");
    expect(fallbackTile).toHaveClass("challenge-tile--fallback");
    expect(fallbackTile.style.getPropertyValue("--challenge-image")).toBe("");
    expect(within(fallbackTile).getByTestId("challenge-fallback")).toHaveAttribute("aria-hidden", "true");
  });

  it("expose une section et des cartes accessibles tout en conservant les textes longs complets", async () => {
    const longTitle = "L".repeat(80);
    const longDescription = "D".repeat(240);
    const challenges = fiveChallenges().map((item) => item.displayOrder === 0
      ? { ...item, title: longTitle, description: longDescription }
      : item);
    renderChallenges(challenges);

    const section = await screen.findByRole("region", { name: /les cinq défis/i });
    expect(within(section).getByRole("heading", { level: 1, name: /les cinq défis/i })).toBeInTheDocument();
    const cards = within(section).getAllByRole("article");
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAccessibleName(longTitle);
    expect(within(cards[0]).getByRole("heading", { name: longTitle })).toHaveTextContent(longTitle);
    expect(within(cards[0]).getByText(longDescription)).toHaveTextContent(longDescription);
  });
});
