import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { EventConfig } from "../../domain/types";
import { validateImageFile } from "../../lib/images";
import { useSaveState } from "./useSaveState";

type EventEditorProps = {
  event: EventConfig;
  onSave(event: EventConfig): Promise<void>;
  uploadBackground(file: File, eventId: string): Promise<string>;
};

function validText(value: string): boolean {
  const length = value.trim().length;
  return length >= 1 && length <= 80;
}

export function EventEditor({ event, onSave, uploadBackground }: EventEditorProps) {
  const [draft, setDraft] = useState(event);
  const [validationError, setValidationError] = useState<string | null>(null);
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
    await save.run(async () => {
      const backgroundUrl = await uploadBackground(file, event.id);
      const updated = { ...draft, backgroundUrl };
      await onSave(updated);
      setDraft(updated);
    });
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
      {message ? <p className="admin-save-status" role="status">{message}</p> : null}
    </section>
  );
}
