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
  removeMedia: vi.fn(),
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

  it("nettoie l'ancien portrait après persistance et compense le nouveau si elle échoue", async () => {
    const user = userEvent.setup();
    const oldUrl = "https://media.example/event-1/participants/p-1-old.webp";
    const newUrl = "https://media.example/event-1/participants/p-1-new.webp";
    const withPortrait = [{ ...participants[0], photoUrl: oldUrl }, participants[1]];
    const removeMedia = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("database timeout"));
    const uploadPhoto = vi.fn().mockResolvedValueOnce(newUrl).mockResolvedValueOnce(`${newUrl}?retry=2`);
    render(<ParticipantsEditor
      {...baseProps}
      participants={withPortrait}
      removeMedia={removeMedia}
      onUpdate={onUpdate}
      uploadPhoto={uploadPhoto}
    />);
    const row = screen.getByRole("group", { name: /alice/i });

    await user.upload(within(row).getByLabelText(/photo/i), new File(["first"], "first.png", { type: "image/png" }));
    expect(removeMedia).toHaveBeenNthCalledWith(1, oldUrl);

    await user.upload(within(row).getByLabelText(/photo/i), new File(["second"], "second.png", { type: "image/png" }));
    expect(removeMedia).toHaveBeenNthCalledWith(2, `${newUrl}?retry=2`);
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

  it("traite la confirmation de suppression comme un dialogue modal accessible et restaure le focus", async () => {
    const user = userEvent.setup();
    render(<ParticipantsEditor {...baseProps} />);
    const alice = screen.getByRole("group", { name: /alice/i });
    const trigger = within(alice).getByRole("button", { name: /supprimer/i });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /supprimer alice/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: /confirmer la suppression/i })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /supprimer alice/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("ferme aussi le dialogue modal de réinitialisation avec Échap et restaure le focus", async () => {
    const user = userEvent.setup();
    render(<ParticipantsEditor {...baseProps} />);
    const trigger = screen.getByRole("button", { name: /réinitialiser la cérémonie/i });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: /confirmer la réinitialisation/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: /confirmer la réinitialisation/i })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /confirmer la réinitialisation/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("confine Tab et Maj+Tab dans le dialogue de suppression", async () => {
    const user = userEvent.setup();
    render(<ParticipantsEditor {...baseProps} />);
    const alice = screen.getByRole("group", { name: /alice/i });
    await user.click(within(alice).getByRole("button", { name: /supprimer/i }));
    const dialog = screen.getByRole("dialog", { name: /supprimer alice/i });
    const confirm = within(dialog).getByRole("button", { name: /confirmer la suppression/i });
    const cancel = within(dialog).getByRole("button", { name: /annuler/i });

    expect(confirm).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
  });

  it("restaure un focus sûr après confirmation de suppression et le déclencheur après reset", async () => {
    const user = userEvent.setup();
    render(<ParticipantsEditor
      {...baseProps}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onResetReveals={vi.fn().mockResolvedValue(undefined)}
    />);
    const alice = screen.getByRole("group", { name: /alice/i });
    await user.click(within(alice).getByRole("button", { name: /supprimer/i }));
    await user.click(screen.getByRole("button", { name: /confirmer la suppression/i }));
    expect(screen.getByRole("button", { name: /réinitialiser la cérémonie/i })).toHaveFocus();

    const resetTrigger = screen.getByRole("button", { name: /réinitialiser la cérémonie/i });
    await user.click(resetTrigger);
    await user.click(screen.getByRole("button", { name: /confirmer la réinitialisation/i }));
    expect(resetTrigger).toHaveFocus();
  });
});
