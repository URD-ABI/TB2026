import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeEvent } from "../../test/fixtures";
import { EventEditor } from "./EventEditor";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, reject, resolve };
}

describe("EventEditor", () => {
  it("enregistre un titre valide et ne confirme qu'après la réponse du dépôt", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    const onSave = vi.fn(() => pending.promise);
    render(<EventEditor event={makeEvent({ title: "Team Building 2026" })} onSave={onSave} uploadBackground={vi.fn()} />);

    const title = screen.getByRole("textbox", { name: /titre de l’événement/i });
    await user.clear(title);
    await user.type(title, "Grand Tournoi 2026");
    await user.click(screen.getByRole("button", { name: /enregistrer l’événement/i }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Grand Tournoi 2026" }));
    expect(screen.getByRole("status")).toHaveTextContent(/enregistrement/i);
    expect(screen.queryByText(/^enregistré/i)).not.toBeInTheDocument();

    await act(async () => pending.resolve());
    expect(await screen.findByRole("status")).toHaveTextContent(/enregistré/i);
  });

  it("refuse un titre vide ou supérieur à 80 caractères", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EventEditor event={makeEvent()} onSave={onSave} uploadBackground={vi.fn()} />);

    const title = screen.getByRole("textbox", { name: /titre de l’événement/i });
    await user.clear(title);
    await user.click(screen.getByRole("button", { name: /enregistrer l’événement/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/titre.*obligatoire/i);

    await user.type(title, "x".repeat(81));
    await user.click(screen.getByRole("button", { name: /enregistrer l’événement/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(/80 caractères/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("optimise, téléverse dans le chemin de l'événement et affiche l'aperçu du nouveau fond", async () => {
    const user = userEvent.setup();
    const uploadBackground = vi.fn().mockResolvedValue("https://media.example/event-1/background.webp");
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EventEditor event={makeEvent({ backgroundUrl: null })} onSave={onSave} uploadBackground={uploadBackground} />);

    const image = new File(["pixels"], "noel.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/arrière-plan personnalisé/i), image);

    expect(uploadBackground).toHaveBeenCalledWith(image, "event-1");
    expect(await screen.findByRole("img", { name: /aperçu de l’arrière-plan/i })).toHaveAttribute(
      "src",
      "https://media.example/event-1/background.webp",
    );
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      id: "event-1",
      backgroundUrl: "https://media.example/event-1/background.webp",
    }));
  });

  it("rejette un fichier trop volumineux avant tout téléversement", async () => {
    const user = userEvent.setup();
    const uploadBackground = vi.fn();
    render(<EventEditor event={makeEvent()} onSave={vi.fn()} uploadBackground={uploadBackground} />);

    const image = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "enorme.webp", { type: "image/webp" });
    await user.upload(screen.getByLabelText(/arrière-plan personnalisé/i), image);

    expect(screen.getByRole("alert")).toHaveTextContent(/10 mio/i);
    expect(uploadBackground).not.toHaveBeenCalled();
  });

  it("affiche une erreur générique sans divulguer le message du service", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("JWT expired for admin@example.fr"));
    render(<EventEditor event={makeEvent()} onSave={onSave} uploadBackground={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /enregistrer l’événement/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enregistrement impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/jwt|admin@example\.fr/i);
  });

  it("supprime l'ancien fond seulement après persistance du nouveau fond", async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    const uploadBackground = vi.fn(async () => {
      calls.push("upload");
      return "https://media.example/event-1/background-new.webp";
    });
    const onSave = vi.fn(async () => { calls.push("persist"); });
    const removeMedia = vi.fn(async () => { calls.push("cleanup-old"); });
    render(<EventEditor
      event={makeEvent({ backgroundUrl: "https://media.example/event-1/background-old.webp" })}
      onSave={onSave}
      uploadBackground={uploadBackground}
      removeMedia={removeMedia}
    />);

    await user.upload(
      screen.getByLabelText(/arrière-plan personnalisé/i),
      new File(["pixels"], "new.png", { type: "image/png" }),
    );

    expect(calls).toEqual(["upload", "persist", "cleanup-old"]);
    expect(removeMedia).toHaveBeenCalledWith("https://media.example/event-1/background-old.webp");
  });

  it("supprime le nouvel objet compensatoire si la persistance échoue", async () => {
    const user = userEvent.setup();
    const newUrl = "https://media.example/event-1/background-new.webp";
    const removeMedia = vi.fn().mockResolvedValue(undefined);
    render(<EventEditor
      event={makeEvent({ backgroundUrl: "https://media.example/event-1/background-old.webp" })}
      onSave={vi.fn().mockRejectedValue(new Error("database timeout"))}
      uploadBackground={vi.fn().mockResolvedValue(newUrl)}
      removeMedia={removeMedia}
    />);

    await user.upload(
      screen.getByLabelText(/arrière-plan personnalisé/i),
      new File(["pixels"], "new.png", { type: "image/png" }),
    );

    expect(removeMedia).toHaveBeenCalledWith(newUrl);
    expect(await screen.findByRole("alert")).toHaveTextContent(/enregistrement impossible/i);
  });

  it("réessaie un nettoyage échoué sans téléverser ni persister une seconde fois", async () => {
    const user = userEvent.setup();
    const oldUrl = "https://media.example/event-1/background-old.webp";
    const uploadBackground = vi.fn().mockResolvedValue("https://media.example/event-1/background-new.webp");
    const onSave = vi.fn().mockResolvedValue(undefined);
    const removeMedia = vi.fn()
      .mockRejectedValueOnce(new Error("storage secret failure"))
      .mockResolvedValueOnce(undefined);
    render(<EventEditor
      event={makeEvent({ backgroundUrl: oldUrl })}
      onSave={onSave}
      uploadBackground={uploadBackground}
      removeMedia={removeMedia}
    />);

    await user.upload(
      screen.getByLabelText(/arrière-plan personnalisé/i),
      new File(["pixels"], "new.png", { type: "image/png" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/nettoyage du média impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/storage secret/i);
    await user.click(screen.getByRole("button", { name: /réessayer le nettoyage/i }));

    expect(removeMedia).toHaveBeenNthCalledWith(1, oldUrl);
    expect(removeMedia).toHaveBeenNthCalledWith(2, oldUrl);
    expect(uploadBackground).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });
});
