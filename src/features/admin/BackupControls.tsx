import { useState } from "react";
import { buildEventExport, eventExportFilename } from "../../domain/export";
import type { EventSnapshot } from "../../repositories/EventRepository";

export function BackupControls({ snapshot, onReset }: { snapshot: EventSnapshot; onReset(eventId: string): Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const exportJson = () => {
    const now = new Date();
    const blob = new Blob([JSON.stringify(buildEventExport(snapshot, now), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = eventExportFilename(now); link.click(); URL.revokeObjectURL(url);
  };
  const reset = async () => {
    if (confirmation !== "REINITIALISER" || pending) return;
    setPending(true); setError(false);
    try { await onReset(snapshot.event.id); setConfirming(false); setConfirmation(""); }
    catch { setError(true); } finally { setPending(false); }
  };
  return <section className="admin-editor admin-backup" aria-labelledby="backup-title"><h2 id="backup-title">Sauvegarde et répétition</h2>
    <button type="button" onClick={exportJson}>Exporter la configuration JSON</button>
    {!confirming ? <button type="button" className="admin-danger-button" onClick={() => setConfirming(true)}>Préparer la réinitialisation</button> : <div className="admin-confirm" role="dialog" aria-modal="true" aria-label="Réinitialiser la répétition">
      <p>Seront supprimés : scores, clés, révélations, réponses et progression du quiz.</p>
      <p>La configuration éditoriale, les équipes, les participants et les médias seront conservés.</p>
      <label>Saisissez REINITIALISER<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      <button type="button" disabled={pending || confirmation !== "REINITIALISER"} onClick={() => void reset()}>Réinitialiser</button>
      <button type="button" disabled={pending} onClick={() => { setConfirming(false); setConfirmation(""); }}>Annuler</button>
    </div>}
    {error ? <p className="admin-alert" role="alert">Réinitialisation impossible. Réessayez.</p> : null}
  </section>;
}
