import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeTeam } from "../../test/fixtures";
import { TeamsEditor } from "./TeamsEditor";

const teams = Array.from({ length: 5 }, (_, index) => makeTeam({
  id: `team-${index + 1}`,
  name: `Équipe ${index + 1}`,
  displayOrder: index,
}));

describe("TeamsEditor", () => {
  it("affiche exactement les cinq équipes existantes sans commande d'ajout ni suppression", () => {
    render(<TeamsEditor teams={teams} onSaveTeam={vi.fn()} applyScore={vi.fn()} onSaveTieBreak={vi.fn()} />);

    expect(screen.getAllByRole("group", { name: /équipe \d/i })).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /ajouter.*équipe|supprimer.*équipe/i })).not.toBeInTheDocument();
  });

  it("modifie le nom, la couleur et l'emblème d'une équipe", async () => {
    const user = userEvent.setup();
    const onSaveTeam = vi.fn().mockResolvedValue(undefined);
    render(<TeamsEditor teams={teams} onSaveTeam={onSaveTeam} applyScore={vi.fn()} onSaveTieBreak={vi.fn()} />);

    const card = screen.getByRole("group", { name: "Équipe 1" });
    const name = within(card).getByRole("textbox", { name: /nom/i });
    await user.clear(name);
    await user.type(name, "Les Rennes");
    await user.clear(within(card).getByRole("textbox", { name: /emblème/i }));
    await user.type(within(card).getByRole("textbox", { name: /emblème/i }), "🦌");
    await user.click(within(card).getByRole("button", { name: /enregistrer l’équipe/i }));

    expect(onSaveTeam).toHaveBeenCalledWith(expect.objectContaining({ id: "team-1", name: "Les Rennes", emblem: "🦌" }));
  });

  it("refuse un nom d'équipe vide", async () => {
    const user = userEvent.setup();
    const onSaveTeam = vi.fn();
    render(<TeamsEditor teams={teams} onSaveTeam={onSaveTeam} applyScore={vi.fn()} onSaveTieBreak={vi.fn()} />);

    const card = screen.getByRole("group", { name: "Équipe 1" });
    await user.clear(within(card).getByRole("textbox", { name: /nom/i }));
    await user.click(within(card).getByRole("button", { name: /enregistrer l’équipe/i }));

    expect(within(card).getByRole("alert")).toHaveTextContent(/nom.*obligatoire/i);
    expect(onSaveTeam).not.toHaveBeenCalled();
  });

  it("permet d'ordonner entièrement un groupe d'au moins trois équipes ex æquo", async () => {
    const user = userEvent.setup();
    const tiedTeams = teams.map((team, index) => ({
      ...team,
      points: index < 3 ? 50 : 40 - index,
      keys: index < 3 ? 3 : 1,
    }));
    const onSaveTieBreak = vi.fn().mockResolvedValue(undefined);
    render(<TeamsEditor teams={tiedTeams} onSaveTeam={vi.fn()} applyScore={vi.fn()} onSaveTieBreak={onSaveTieBreak} />);

    const panel = screen.getByRole("group", { name: /départage/i });
    expect(within(panel).getByText("Équipe 1")).toBeInTheDocument();
    expect(within(panel).getByText("Équipe 2")).toBeInTheDocument();
    expect(within(panel).getByText("Équipe 3")).toBeInTheDocument();
    expect(within(panel).queryByText("Équipe 4")).not.toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: /monter équipe 3/i }));
    await user.click(within(panel).getByRole("button", { name: /enregistrer le départage/i }));

    expect(onSaveTieBreak).toHaveBeenCalledWith("event-1", ["team-1", "team-3", "team-2"]);
  });

  it("affiche et enregistre séparément plusieurs groupes ex æquo", async () => {
    const user = userEvent.setup();
    const tiedTeams = teams.map((team, index) => ({
      ...team,
      points: index < 2 ? 50 : 30,
      keys: index < 2 ? 3 : 1,
    }));
    const onSaveTieBreak = vi.fn().mockResolvedValue(undefined);
    render(<TeamsEditor teams={tiedTeams} onSaveTeam={vi.fn()} applyScore={vi.fn()} onSaveTieBreak={onSaveTieBreak} />);

    const panels = screen.getAllByRole("group", { name: /départage/i });
    expect(panels).toHaveLength(2);
    await user.click(within(panels[1]).getByRole("button", { name: /monter équipe 5/i }));
    await user.click(within(panels[1]).getByRole("button", { name: /enregistrer le départage/i }));

    expect(onSaveTieBreak).toHaveBeenCalledWith("event-1", ["team-3", "team-5", "team-4"]);
  });
});
