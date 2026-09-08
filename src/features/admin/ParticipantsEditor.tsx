import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { AdminParticipant, Team } from "../../domain/types";
import { validateImageFile } from "../../lib/images";
import { useSaveState } from "./useSaveState";

export type NewParticipant = {
  eventId: string;
  name: string;
  photoUrl: string | null;
  assignedTeamId: string;
  revealOrder: number;
};

type ParticipantsEditorProps = {
  eventId: string;
  teams: Team[];
  participants: AdminParticipant[];
  onCreate(input: NewParticipant): Promise<void>;
  onUpdate(participant: AdminParticipant): Promise<void>;
  onDelete(eventId: string, participantId: string): Promise<void>;
  onReorder(eventId: string, orderedParticipantIds: string[]): Promise<void>;
  onResetReveals(eventId: string): Promise<void>;
  uploadPhoto(file: File, eventId: string, participantId: string): Promise<string>;
};

export function ParticipantsEditor(props: ParticipantsEditorProps) {
  const [items, setItems] = useState(() => [...props.participants].sort((a, b) => a.revealOrder - b.revealOrder));
  const [newName, setNewName] = useState("");
  const [newTeamId, setNewTeamId] = useState(props.teams[0]?.id ?? "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminParticipant | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const deleteReturnFocus = useRef<HTMLButtonElement | null>(null);
  const resetReturnFocus = useRef<HTMLButtonElement | null>(null);
  const createSave = useSaveState();
  const destructiveSave = useSaveState();

  useEffect(() => setItems([...props.participants].sort((a, b) => a.revealOrder - b.revealOrder)), [props.participants]);

  const nextOrder = useMemo(() => items.reduce((maximum, item) => Math.max(maximum, item.revealOrder), -1) + 1, [items]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) {
      setValidationError("Le nom du participant est obligatoire.");
      return;
    }
    if (!newTeamId) {
      setValidationError("Choisissez une équipe prédéfinie.");
      return;
    }
    setValidationError(null);
    const saved = await createSave.run(() => props.onCreate({
      eventId: props.eventId,
      name: newName.trim(),
      photoUrl: null,
      assignedTeamId: newTeamId,
      revealOrder: nextOrder,
    }));
    if (saved) setNewName("");
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((item, revealOrder) => ({ ...item, revealOrder }));
    const previous = items;
    setItems(normalized);
    const saved = await destructiveSave.run(() => props.onReorder(props.eventId, normalized.map((item) => item.id)));
    if (!saved) setItems(previous);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const saved = await destructiveSave.run(() => props.onDelete(props.eventId, target.id));
    if (saved) setItems((current) => current.filter((item) => item.id !== target.id));
    setDeleteTarget(null);
  };

  const reset = async () => {
    const saved = await destructiveSave.run(() => props.onResetReveals(props.eventId));
    if (saved) setItems((current) => current.map((item) => ({ ...item, revealedAt: null, revealedTeamId: null })));
    setResetPending(false);
  };

  const cancelDelete = () => {
    deleteReturnFocus.current?.focus();
    setDeleteTarget(null);
  };

  const cancelReset = () => {
    resetReturnFocus.current?.focus();
    setResetPending(false);
  };

  return (
    <section className="admin-editor" aria-labelledby="participants-editor-title">
      <h2 id="participants-editor-title">Gestion des participants</h2>
      <form className="admin-form admin-participant-create" aria-label="Ajouter un participant" onSubmit={(event) => void create(event)}>
        <label>Nom<input value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
        <label>
          Équipe prédéfinie
          <select value={newTeamId} onChange={(event) => setNewTeamId(event.target.value)}>
            {props.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={createSave.state === "saving"}>Ajouter</button>
        {validationError ? <p className="admin-alert" role="alert">{validationError}</p> : null}
        {createSave.state === "error" ? <p className="admin-alert" role="alert">Enregistrement impossible. Réessayez.</p> : null}
      </form>

      <div className="admin-participant-list">
        {items.map((participant, index) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            teams={props.teams}
            first={index === 0}
            last={index === items.length - 1}
            onMove={(direction) => void move(index, direction)}
            onDelete={(trigger) => {
              deleteReturnFocus.current = trigger;
              setDeleteTarget(participant);
            }}
            onUpdate={props.onUpdate}
            uploadPhoto={props.uploadPhoto}
          />
        ))}
      </div>

      <button
        ref={resetReturnFocus}
        type="button"
        className="admin-danger-button"
        onClick={() => setResetPending(true)}
      >Réinitialiser la cérémonie</button>
      {resetPending ? (
        <div
          className="admin-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmer la réinitialisation"
          onKeyDown={(event) => { if (event.key === "Escape") cancelReset(); }}
        >
          <p>Les participants pourront être révélés à nouveau. Leurs équipes prédéfinies seront conservées.</p>
          <button autoFocus type="button" onClick={() => void reset()}>Confirmer la réinitialisation</button>
          <button type="button" onClick={cancelReset}>Annuler</button>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="admin-confirm"
          role="dialog"
          aria-modal="true"
          aria-label={`Supprimer ${deleteTarget.name}`}
          onKeyDown={(event) => { if (event.key === "Escape") cancelDelete(); }}
        >
          <p>Supprimer {deleteTarget.name} de la cérémonie ?</p>
          <button autoFocus type="button" onClick={() => void remove()}>Confirmer la suppression</button>
          <button type="button" onClick={cancelDelete}>Annuler</button>
        </div>
      ) : null}
      {destructiveSave.state === "error" ? <p className="admin-alert" role="alert">Opération impossible. Réessayez.</p> : null}
    </section>
  );
}

type ParticipantCardProps = {
  participant: AdminParticipant;
  teams: Team[];
  first: boolean;
  last: boolean;
  onMove(direction: -1 | 1): void;
  onDelete(trigger: HTMLButtonElement): void;
  onUpdate(participant: AdminParticipant): Promise<void>;
  uploadPhoto: ParticipantsEditorProps["uploadPhoto"];
};

function ParticipantCard({ participant, teams, first, last, onMove, onDelete, onUpdate, uploadPhoto }: ParticipantCardProps) {
  const [draft, setDraft] = useState(participant);
  const [validationError, setValidationError] = useState<string | null>(null);
  const save = useSaveState();
  useEffect(() => setDraft(participant), [participant]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setValidationError("Le nom du participant est obligatoire.");
      return;
    }
    setValidationError(null);
    await save.run(() => onUpdate({ ...draft, name: draft.name.trim() }));
  };

  const changePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      validateImageFile(file);
    } catch {
      setValidationError("Choisissez une image JPEG, PNG ou WebP de 10 Mio maximum.");
      return;
    }
    setValidationError(null);
    await save.run(async () => {
      const photoUrl = await uploadPhoto(file, participant.eventId, participant.id);
      const updated = { ...draft, photoUrl };
      await onUpdate(updated);
      setDraft(updated);
    });
  };

  return (
    <fieldset className="admin-participant-card">
      <legend>{participant.name}</legend>
      {draft.photoUrl ? <img src={draft.photoUrl} alt={`Photo de ${participant.name}`} /> : null}
      <form className="admin-form admin-form--compact" onSubmit={(event) => void submit(event)}>
        <label>Nom<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>
          Équipe prédéfinie
          <select value={draft.assignedTeamId} onChange={(event) => setDraft({ ...draft, assignedTeamId: event.target.value })}>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        <label>Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changePhoto(event)} /></label>
        <button type="submit" disabled={save.state === "saving"}>Enregistrer</button>
      </form>
      <div className="admin-order-controls">
        <button type="button" disabled={first} onClick={() => onMove(-1)}>Monter</button>
        <button type="button" disabled={last} onClick={() => onMove(1)}>Descendre</button>
        <button type="button" onClick={(event) => onDelete(event.currentTarget)}>Supprimer</button>
      </div>
      {validationError ? <p className="admin-alert" role="alert">{validationError}</p> : null}
      {save.state === "error" ? <p className="admin-alert" role="alert">Enregistrement impossible. Réessayez.</p> : null}
    </fieldset>
  );
}
