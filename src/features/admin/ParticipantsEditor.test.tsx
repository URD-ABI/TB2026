import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminParticipant } from "../../domain/types";
import { makeParticipant, makeTeam } from "../../test/fixtures";
import { ParticipantsEditor } from "./ParticipantsEditor";

const teams = [makeTeam({ id: "team-1", name: "Hiboux" }), makeTeam({ id: "team-2", name: "Rennes" })];
const participants: AdminParticipant[] = [
  { ...makeParticipant({ id: "p-1", name: "Alice", revealOrder: 0 }), assignedTeamId: "team-1" },
  { ...makeParticipant({ id: "p-2", name: "Benoît", revealOrder: 1 }), assignedTeamId: "team-2" },
];

const baseProps = {
  eventId: "event-1",
  teams,
  participants,
  onCreate: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onReorder: vi.fn(),
  onResetReveals: vi.fn(),
  uploadPhoto: vi.fn(),
};

describe("ParticipantsEditor", () => {
  it("crée un participant avec un nom, une équipe prédéfinie et le prochain ordre", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantsEditor {...baseProps} onCreate={onCreate} />);

    const form = screen.getByRole("form", { name: /ajouter un participant/i });
    await user.type(within(form).getByRole("textbox", { name: /nom/i }), "Chloé");
    await user.selectOptions(within(form).getByRole("combobox", { name: /équipe prédéfinie/i }), "team-2");
    await user.click(within(form).getByRole("button", { name: /ajouter/i }));

    expect(onCreate).toHaveBeenCalledWith({
      eventId: "event-1",
      name: "Chloé",
      photoUrl: null,
      assignedTeamId: "team-2",
      revealOrder: 2,
    });
  });

  it("refuse de créer ou enregistrer un participant sans nom", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<ParticipantsEditor {...baseProps} onCreate={onCreate} />);

    const form = screen.getByRole("form", { name: /ajouter un participant/i });
    await user.click(within(form).getByRole("button", { name: /ajouter/i }));

    expect(within(form).getByRole("alert")).toHaveTextContent(/nom.*obligatoire/i);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("modifie le nom et l'équipe prédéfinie d'un participant", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantsEditor {...baseProps} onUpdate={onUpdate} />);

    const row = screen.getByRole("group", { name: /alice/i });
    const name = within(row).getByRole("textbox", { name: /nom/i });
    await user.clear(name);
    await user.type(name, "Alicia");
    await user.selectOptions(within(row).getByRole("combobox", { name: /équipe prédéfinie/i }), "team-2");
    await user.click(within(row).getByRole("button", { name: /enregistrer/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: "p-1",
      name: "Alicia",
      assignedTeamId: "team-2",
    }));
  });

  it("téléverse une photo dans l'espace de l'événement puis enregistre son URL", async () => {
    const user = userEvent.setup();
    const uploadPhoto = vi.fn().mockResolvedValue("https://media.example/event-1/participants/p-1.webp");
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantsEditor {...baseProps} uploadPhoto={uploadPhoto} onUpdate={onUpdate} />);

    const row = screen.getByRole("group", { name: /alice/i });
    const photo = new File(["pixels"], "alice.jpeg", { type: "image/jpeg" });
    await user.upload(within(row).getByLabelText(/photo/i), photo);

    expect(uploadPhoto).toHaveBeenCalledWith(photo, "event-1", "p-1");
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: "p-1",
      photoUrl: "https://media.example/event-1/participants/p-1.webp",
    }));
    expect(await within(row).findByRole("img", { name: /photo de alice/i })).toHaveAttribute(
      "src",
      "https://media.example/event-1/participants/p-1.webp",
    );
  });

  it("réordonne les participants en transmettant tous les identifiants", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantsEditor {...baseProps} onReorder={onReorder} />);

    const benoit = screen.getByRole("group", { name: /benoît/i });
    await user.click(within(benoit).getByRole("button", { name: /monter/i }));

    expect(onReorder).toHaveBeenCalledWith("event-1", ["p-2", "p-1"]);
  });

  it("demande confirmation avant de supprimer un participant", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantsEditor {...baseProps} onDelete={onDelete} />);

    const alice = screen.getByRole("group", { name: /alice/i });
    await user.click(within(alice).getByRole("button", { name: /supprimer/i }));
    expect(onDelete).not.toHaveBeenCalled();

    const confirmation = screen.getByRole("dialog", { name: /supprimer alice/i });
    await user.click(within(confirmation).getByRole("button", { name: /confirmer la suppression/i }));
    expect(onDelete).toHaveBeenCalledWith("event-1", "p-1");
  });

  it("réinitialise les révélations après confirmation sans supprimer les affectations", async () => {
    const user = userEvent.setup();
    const onResetReveals = vi.fn().mockResolvedValue(undefined);
    render(<ParticipantsEditor {...baseProps} onResetReveals={onResetReveals} />);

    await user.click(screen.getByRole("button", { name: /réinitialiser la cérémonie/i }));
    expect(onResetReveals).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirmer la réinitialisation/i }));

    expect(onResetReveals).toHaveBeenCalledWith("event-1");
  });
});
