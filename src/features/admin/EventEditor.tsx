import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { EventConfig } from "../../domain/types";
import { validateImageFile } from "../../lib/images";
import { useSaveState } from "./useSaveState";

type EventEditorProps = {
  event: EventConfig;
  onSave(event: EventConfig): Promise<void>;
  uploadBackground(file: File, eventId: string): Promise<string>;
  removeMedia?(url: string): Promise<void>;
};

function validText(value: string): boolean {
  const length = value.trim().length;
  return length >= 1 && length <= 80;
}

export function EventEditor({ event, onSave, uploadBackground, removeMedia = async () => undefined }: EventEditorProps) {
  const [draft, setDraft] = useState(event);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingCleanup, setPendingCleanup] = useState<string | null>(null);
  const save = useSaveState();

  useEffect(() => setDraft(event), [event]);

  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!draft.title.trim()) {
      setValidationError("Le titre est obligatoire.");
      return;
    }
    if (!validText(draft.title) || !validText(draft.subtitle)) {
      setValidationError("Le titre et le sous-titre doivent contenir au maximum 80 caractères.");
      return;
    }
    if (!Number.isInteger(draft.scoreCapacity) || draft.scoreCapacity <= 0) {
      setValidationError("La capacité doit être un nombre entier supérieur à zéro.");
      return;
    }
    setValidationError(null);
    await save.run(() => onSave({ ...draft, title: draft.title.trim(), subtitle: draft.subtitle.trim() }));
  };

  const changeBackground = async (changeEvent: ChangeEvent<HTMLInputElement>) => {
    const file = changeEvent.target.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
    } catch (error) {
      setValidationError(error instanceof Error && error.message === "image_too_large"
        ? "L’image ne doit pas dépasser 10 Mio."
        : "Choisissez une image JPEG, PNG ou WebP.");
      return;
    }

    setValidationError(null);
    let backgroundUrl: string | null = null;
    const persisted = await save.run(async () => {
      backgroundUrl = await uploadBackground(file, event.id);
      await onSave({ ...draft, backgroundUrl });
    });
    if (!backgroundUrl) return;
    if (!persisted) {
      try {
        await removeMedia(backgroundUrl);
      } catch {
        setPendingCleanup(backgroundUrl);
      }
      return;
    }

    setDraft({ ...draft, backgroundUrl });
  };

  const retryCleanup = async () => {
    if (!pendingCleanup) return;
    try {
      await removeMedia(pendingCleanup);
      setPendingCleanup(null);
    } catch {
      // Keep the exact path so the same cleanup remains safely retryable.
    }
  };

  const message = save.state === "saving" ? "Enregistrement en cours…"
    : save.state === "saved" ? "Enregistré."
      : null;

  return (
    <section className="admin-editor" aria-labelledby="event-editor-title">
      <h2 id="event-editor-title">Paramètres de l’événement</h2>
      <p>Personnalisez les textes principaux et l’unique arrière-plan projeté.</p>

      <form className="admin-form" onSubmit={(formEvent) => void submit(formEvent)}>
        <label>
          Titre de l’événement
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
        </label>
        <label>
          Sous-titre
          <input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} />
        </label>
        <label>
          Capacité d’un réceptacle (points)
          <input
            type="number"
            min={1}
            step={1}
            value={Number.isFinite(draft.scoreCapacity) ? draft.scoreCapacity : ""}
            onChange={(event) => setDraft({
              ...draft,
              scoreCapacity: event.target.value === "" ? Number.NaN : Number(event.target.value),
            })}
          />
        </label>
        <button type="submit" disabled={save.state === "saving"}>Enregistrer l’événement</button>
      </form>

      <div className="admin-media-field">
        <label>
          Arrière-plan personnalisé
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changeBackground(event)} />
        </label>
        {draft.backgroundUrl ? (
          <img className="admin-background-preview" src={draft.backgroundUrl} alt="Aperçu de l’arrière-plan" />
        ) : null}
      </div>

      {validationError ? <p className="admin-alert" role="alert">{validationError}</p> : null}
      {save.state === "error" ? <p className="admin-alert" role="alert">Enregistrement impossible. Réessayez.</p> : null}
      {pendingCleanup ? (
        <div className="admin-alert" role="alert">
          Nettoyage du média impossible. Réessayez.
          <button type="button" onClick={() => void retryCleanup()}>Réessayer le nettoyage</button>
        </div>
      ) : null}
      {message ? <p className="admin-save-status" role="status">{message}</p> : null}
    </section>
  );
}
