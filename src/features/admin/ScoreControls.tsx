import { useState } from "react";
import type { Team } from "../../domain/types";
import type { EventRepository } from "../../repositories/EventRepository";
import { useSaveState } from "./useSaveState";

type ScoreInput = Parameters<EventRepository["applyScore"]>[0];

type ScoreControlsProps = {
  team: Team;
  applyScore(input: ScoreInput): Promise<void>;
};

export function ScoreControls({ team, applyScore }: ScoreControlsProps) {
  const save = useSaveState();
  const [customPoints, setCustomPoints] = useState("");
  const [customKeys, setCustomKeys] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const apply = async (points: number, keys: number) => {
    setValidationError(null);
    await save.run(() => applyScore({
      eventId: team.eventId,
      teamId: team.id,
      points,
      keys,
      source: "manual",
      idempotencyKey: crypto.randomUUID(),
    }));
  };

  const applyCustom = async () => {
    const points = Number(customPoints);
    const keys = Number(customKeys);
    if (customPoints.trim() === "" || !Number.isInteger(points) || (customKeys.trim() !== "" && !Number.isInteger(keys))) {
      setValidationError("Saisissez une valeur entière.");
      return;
    }
    if (team.keys + (customKeys.trim() === "" ? 0 : keys) < 0) {
      setValidationError("Le nombre de clés ne peut pas être négatif.");
      return;
    }
    await apply(points, customKeys.trim() === "" ? 0 : keys);
  };

  const disabled = save.state === "saving";

  return (
    <div className="score-controls">
      <p className="score-controls__current">{team.points} points · {team.keys} clés</p>
      <div className="score-controls__quick">
        <button type="button" disabled={disabled} onClick={() => void apply(10, 0)}>Ajouter 10 points</button>
        <button type="button" disabled={disabled} onClick={() => void apply(-10, 0)}>Retirer 10 points</button>
        <button type="button" disabled={disabled} onClick={() => void apply(0, 1)}>Ajouter 1 clé</button>
        <button type="button" disabled={disabled || team.keys === 0} onClick={() => void apply(0, -1)}>Retirer 1 clé</button>
      </div>
      <fieldset className="score-controls__custom">
        <legend>Ajustement libre</legend>
        <label>Points<input type="number" step="1" value={customPoints} onChange={(event) => setCustomPoints(event.target.value)} /></label>
        <label>Clés<input type="number" step="1" value={customKeys} onChange={(event) => setCustomKeys(event.target.value)} /></label>
        <button type="button" disabled={disabled} onClick={() => void applyCustom()}>Appliquer</button>
      </fieldset>
      {validationError ? <p className="admin-alert" role="alert">{validationError}</p> : null}
      {save.state === "error" ? <p className="admin-alert" role="alert">Enregistrement impossible. Réessayez.</p> : null}
      {save.state === "saving" ? <p role="status">Enregistrement en cours…</p> : null}
      {save.state === "saved" ? <p role="status">Enregistré.</p> : null}
    </div>
  );
}
