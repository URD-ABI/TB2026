import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { Challenge } from "../../domain/types";
import { validateImageFile } from "../../lib/images";

type Props = {
  challenges: Challenge[];
  onSave(challenge: Challenge): Promise<void>;
  onReorder(eventId: string, orderedIds: string[]): Promise<void>;
  uploadImage(file: File, eventId: string, challengeId: string): Promise<string>;
  removeMedia?(url: string): Promise<void>;
};

export function ChallengesEditor({ challenges, onSave, onReorder, uploadImage, removeMedia = async () => undefined }: Props) {
  const [items, setItems] = useState(() => [...challenges].sort((a, b) => a.displayOrder - b.displayOrder));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => setItems([...challenges].sort((a, b) => a.displayOrder - b.displayOrder)), [challenges]);
  if (items.length !== 5) return <section className="admin-editor"><h2>Défis</h2><p className="admin-alert" role="alert">L’événement doit contenir exactement cinq défis.</p></section>;

  const change = (id: string, patch: Partial<Challenge>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const save = async (event: FormEvent, challenge: Challenge) => {
    event.preventDefault();
    if (!challenge.title.trim() || !challenge.kind.trim() || !challenge.description.trim()) { setError("Le titre, le type et la description sont obligatoires."); return; }
    setSaving(true); setError(null);
    try { await onSave({ ...challenge, title: challenge.title.trim(), kind: challenge.kind.trim(), description: challenge.description.trim() }); }
    catch { setError("Enregistrement du défi impossible. Réessayez."); }
    finally { setSaving(false); }
  };
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length || saving) return;
    const previous = items;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((item, displayOrder) => ({ ...item, displayOrder }));
    setItems(normalized); setSaving(true); setError(null);
    try { await onReorder(normalized[0].eventId, normalized.map((item) => item.id)); }
    catch { setItems(previous); setError("Réorganisation impossible. Réessayez."); }
    finally { setSaving(false); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>, challenge: Challenge) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { validateImageFile(file); } catch { setError("Choisissez une image JPEG, PNG ou WebP de 10 Mio maximum."); return; }
    setSaving(true); setError(null);
    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadImage(file, challenge.eventId, challenge.id);
      await onSave({ ...challenge, imageUrl });
      change(challenge.id, { imageUrl });
    } catch {
      if (imageUrl) { try { await removeMedia(imageUrl); } catch { /* La file durable prendra le relais. */ } }
      setError("Enregistrement de l’image impossible. Réessayez.");
    } finally { setSaving(false); }
  };

  return <section className="admin-editor" aria-labelledby="challenges-editor-title">
    <h2 id="challenges-editor-title">Défis</h2><p>Modifiez les cinq épreuves et leur ordre d’affichage.</p>
    <div className="admin-card-grid">{items.map((challenge, index) => <fieldset className="admin-content-card" aria-label={`Défi ${index + 1}`} key={challenge.id}>
      <legend>Défi {index + 1}</legend>
      {challenge.imageUrl ? <img src={challenge.imageUrl} alt="Aperçu du montage" /> : null}
      <form className="admin-form admin-form--compact" onSubmit={(event) => void save(event, challenge)}>
        <label>Titre<input value={challenge.title} onChange={(event) => change(challenge.id, { title: event.target.value })} /></label>
        <label>Type<input value={challenge.kind} onChange={(event) => change(challenge.id, { kind: event.target.value })} /></label>
        <label>Description<textarea value={challenge.description} onChange={(event) => change(challenge.id, { description: event.target.value })} /></label>
        <label>Montage photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event, challenge)} /></label>
        <button type="submit" disabled={saving}>Enregistrer le défi</button>
      </form>
      <div className="admin-order-controls"><button type="button" disabled={saving || index === 0} onClick={() => void move(index, -1)}>Monter</button><button type="button" disabled={saving || index === items.length - 1} onClick={() => void move(index, 1)}>Descendre</button></div>
    </fieldset>)}</div>
    {error ? <p className="admin-alert" role="alert">{error}</p> : null}
  </section>;
}
