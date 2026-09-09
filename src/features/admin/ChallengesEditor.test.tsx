import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Challenge } from "../../domain/types";
import { ChallengesEditor } from "./ChallengesEditor";

const challenges: Challenge[] = Array.from({ length: 5 }, (_, index) => ({
  id: `challenge-${index + 1}`,
  eventId: "event-1",
  title: `Défi ${index + 1}`,
  kind: "adresse",
  description: `Description ${index + 1}`,
  imageUrl: null,
  displayOrder: index,
}));

describe("ChallengesEditor", () => {
  it("maintient exactement cinq défis sans commande de création ou suppression", () => {
    render(<ChallengesEditor challenges={challenges} onSave={vi.fn()} onReorder={vi.fn()} uploadImage={vi.fn()} />);
    expect(screen.getAllByRole("group", { name: /défi \d/i })).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /ajouter|supprimer/i })).not.toBeInTheDocument();
  });

  it("enregistre les textes modifiés et échange les positions", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onReorder = vi.fn().mockResolvedValue(undefined);
    render(<ChallengesEditor challenges={challenges} onSave={onSave} onReorder={onReorder} uploadImage={vi.fn()} />);

    const first = screen.getByRole("group", { name: "Défi 1" });
    await user.clear(within(first).getByLabelText("Titre"));
    await user.type(within(first).getByLabelText("Titre"), "La clef engloutie");
    await user.click(first.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "La clef engloutie" }));

    await user.click(screen.getAllByRole("button", { name: "Descendre" })[0]);
    expect(onReorder).toHaveBeenCalledWith("event-1", ["challenge-2", "challenge-1", "challenge-3", "challenge-4", "challenge-5"]);
  });

  it("refuse une liste dont la cardinalité n'est pas cinq", () => {
    render(<ChallengesEditor challenges={challenges.slice(0, 4)} onSave={vi.fn()} onReorder={vi.fn()} uploadImage={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/exactement cinq défis/i);
  });
});
