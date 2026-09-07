import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  it("rend exactement cinq défis dans l’ordre displayOrder et met uniquement le premier en avant", async () => {
    renderChallenges();

    const tiles = await screen.findAllByTestId("challenge-tile");
    expect(tiles).toHaveLength(5);
    expect(tiles.map((tile) => within(tile).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "La clé des glaces",
      "Les remparts givrés",
      "Le relais des hiboux",
      "La salle des énigmes",
      "Le banquet secret",
    ]);
    expect(tiles[0]).toHaveClass("challenge-tile--featured");
    for (const tile of tiles.slice(1)) expect(tile).not.toHaveClass("challenge-tile--featured");
  });

  it("affiche pour chaque tuile un numéro sur deux chiffres, le type, le titre et la description", async () => {
    renderChallenges();

    const tiles = await screen.findAllByTestId("challenge-tile");
    expect(tiles.map((tile) => within(tile).getByTestId("challenge-number").textContent)).toEqual([
      "01", "02", "03", "04", "05",
    ]);
    expect(within(tiles[0]).getByText("Adresse")).toBeInTheDocument();
    expect(within(tiles[0]).getByRole("heading", { name: "La clé des glaces" })).toBeInTheDocument();
    expect(within(tiles[0]).getByText("Rapportez la clé avant que le sablier ne soit vide.")).toBeInTheDocument();
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
    renderChallenges();

    const fallbackTile = (await screen.findAllByTestId("challenge-tile"))[1];
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
    expect(cards).toHaveLength(5);
    expect(cards[0]).toHaveAccessibleName(longTitle);
    expect(within(cards[0]).getByRole("heading", { name: longTitle })).toHaveTextContent(longTitle);
    expect(within(cards[0]).getByText(longDescription)).toHaveTextContent(longDescription);
  });
});
