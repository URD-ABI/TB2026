import { useState } from "react";
import type { ScoreEvent, Team } from "../../domain/types";

export function ScoreHistory({ events, teams, onReverse }: { events: ScoreEvent[]; teams: Team[]; onReverse(scoreEventId: string): Promise<void> }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const names = new Map(teams.map((team) => [team.id, team.name]));
  const reverse = async (id: string) => {
    setPendingId(id); setError(false);
    try { await onReverse(id); } catch { setError(true); } finally { setPendingId(null); }
  };
  return <section className="admin-score-history" aria-labelledby="score-history-title"><h3 id="score-history-title">Historique des scores</h3>
    {events.length === 0 ? <p>Aucune opération enregistrée.</p> : <ol>{events.map((event) => <li key={event.id} className={event.reversedAt ? "is-reversed" : undefined}>
      <span>{names.get(event.teamId) ?? "Équipe inconnue"}</span><span>{event.pointsDelta >= 0 ? "+" : ""}{event.pointsDelta} points · {event.keysDelta >= 0 ? "+" : ""}{event.keysDelta} clé(s)</span><span>{event.source}</span>
      {event.reversedAt ? <em>Annulée</em> : <button type="button" disabled={pendingId !== null} onClick={() => void reverse(event.id)}>Annuler cette opération</button>}
    </li>)}</ol>}
    {error ? <p className="admin-alert" role="alert">Annulation impossible. Réessayez.</p> : null}
  </section>;
}
