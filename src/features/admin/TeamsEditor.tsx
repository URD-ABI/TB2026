import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Team } from "../../domain/types";
import type { EventRepository } from "../../repositories/EventRepository";
import { ScoreControls } from "./ScoreControls";
import { useSaveState } from "./useSaveState";

type TeamsEditorProps = {
  teams: Team[];
  onSaveTeam(team: Team): Promise<void>;
  applyScore: EventRepository["applyScore"];
  onSaveTieBreak(eventId: string, orderedTeamIds: string[]): Promise<void>;
};

function TeamCard({ team, onSaveTeam, applyScore }: Pick<TeamsEditorProps, "onSaveTeam" | "applyScore"> & { team: Team }) {
  const [draft, setDraft] = useState(team);
  const [validationError, setValidationError] = useState<string | null>(null);
  const save = useSaveState();
  useEffect(() => setDraft(team), [team]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) {
      setValidationError("Le nom de l’équipe est obligatoire.");
      return;
    }
    setValidationError(null);
    await save.run(() => onSaveTeam({ ...draft, name: draft.name.trim() }));
  };

  return (
    <fieldset className="admin-team-card">
      <legend>{team.name}</legend>
      <form className="admin-form admin-form--compact" onSubmit={(event) => void submit(event)}>
        <label>Nom<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>Couleur<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>
        <label>Emblème<input value={draft.emblem} onChange={(event) => setDraft({ ...draft, emblem: event.target.value })} /></label>
        <button type="submit" disabled={save.state === "saving"}>Enregistrer l’équipe</button>
      </form>
      {validationError ? <p className="admin-alert" role="alert">{validationError}</p> : null}
      {save.state === "error" ? <p className="admin-alert" role="alert">Enregistrement impossible. Réessayez.</p> : null}
      {save.state === "saving" ? <p role="status">Enregistrement en cours…</p> : null}
      {save.state === "saved" ? <p role="status">Enregistré.</p> : null}
      <ScoreControls team={team} applyScore={applyScore} />
    </fieldset>
  );
}

export function TeamsEditor({ teams, onSaveTeam, applyScore, onSaveTieBreak }: TeamsEditorProps) {
  const orderedTeams = useMemo(() => [...teams].sort((left, right) => left.displayOrder - right.displayOrder).slice(0, 5), [teams]);
  const tiedGroups = useMemo(() => {
    const groups = new Map<string, Team[]>();
    for (const team of orderedTeams) {
      const key = `${team.points}:${team.keys}`;
      groups.set(key, [...(groups.get(key) ?? []), team]);
    }
    return [...groups.values()].filter((group) => group.length > 1);
  }, [orderedTeams]);

  return (
    <section className="admin-editor" aria-labelledby="teams-editor-title">
      <h2 id="teams-editor-title">Équipes et scores</h2>
      <div className="admin-team-grid">
        {orderedTeams.map((team) => (
          <TeamCard key={team.id} team={team} onSaveTeam={onSaveTeam} applyScore={applyScore} />
        ))}
      </div>
      {tiedGroups.map((group) => <TieBreakPanel key={`${group[0].points}:${group[0].keys}`} teams={group} onSave={onSaveTieBreak} />)}
    </section>
  );
}

function TieBreakPanel({ teams, onSave }: { teams: Team[]; onSave: TeamsEditorProps["onSaveTieBreak"] }) {
  const [order, setOrder] = useState(() => initialTieBreakOrder(teams));
  const save = useSaveState();
  useEffect(() => setOrder(initialTieBreakOrder(teams)), [teams]);

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= order.length) return;
    setOrder((current) => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  };

  return (
    <fieldset className="admin-tie-break">
      <legend>Départage requis</legend>
      <p>Classez toutes les équipes de ce groupe selon l’épreuve de départage.</p>
      <ol className="admin-tie-break__order">
        {order.map((teamId, index) => {
          const team = teams.find((item) => item.id === teamId)!;
          return (
            <li key={team.id}>
              <span>{team.name}</span>
              <button type="button" disabled={index === 0} aria-label={`Monter ${team.name}`} onClick={() => move(index, -1)}>↑</button>
              <button type="button" disabled={index === order.length - 1} aria-label={`Descendre ${team.name}`} onClick={() => move(index, 1)}>↓</button>
            </li>
          );
        })}
      </ol>
      <button type="button" disabled={save.state === "saving"} onClick={() => void save.run(() => onSave(teams[0].eventId, order))}>
        Enregistrer le départage
      </button>
      {save.state === "error" ? <p className="admin-alert" role="alert">Enregistrement impossible. Réessayez.</p> : null}
    </fieldset>
  );
}

function initialTieBreakOrder(teams: Team[]): string[] {
  return [...teams]
    .sort((left, right) => {
      if (left.tieBreakPriority !== null && right.tieBreakPriority !== null) {
        return left.tieBreakPriority - right.tieBreakPriority;
      }
      if (left.tieBreakPriority !== null) return -1;
      if (right.tieBreakPriority !== null) return 1;
      return left.displayOrder - right.displayOrder;
    })
    .map((team) => team.id);
}
