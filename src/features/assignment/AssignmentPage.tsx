import { useEffect, useMemo, useRef, useState } from "react";
import { useEventContext } from "../../app/AppProviders";
import { buildReelSequence, nextParticipant } from "../../domain/assignment";
import type { Participant, Team } from "../../domain/types";
import { TeamReel } from "./TeamReel";
import "./assignment.css";

type RevealResult = {
  participant: Participant;
  teamId: string;
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("fr") ?? "")
    .join("");
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ParticipantPortrait({ participant, className = "" }: { participant: Participant; className?: string }) {
  if (participant.photoUrl) {
    return (
      <img
        className={`participant-portrait ${className}`.trim()}
        src={participant.photoUrl}
        alt={`Portrait de ${participant.name}`}
      />
    );
  }

  return (
    <span className={`participant-portrait participant-portrait--initials ${className}`.trim()} aria-label={`Portrait de ${participant.name}`}>
      {initials(participant.name)}
    </span>
  );
}

function ParticipantToken({
  participant,
  team,
  isNew,
}: {
  participant: Participant;
  team: Team;
  isNew: boolean;
}) {
  const label = `${participant.name} — ${team.name}`;
  const newClass = isNew ? " participant-token--new" : "";

  if (participant.photoUrl) {
    return (
      <img
        className={`participant-token${newClass}`}
        src={participant.photoUrl}
        alt={label}
        title={participant.name}
      />
    );
  }

  return (
    <span
      className={`participant-token participant-token--initials${newClass}`}
      aria-label={label}
      title={participant.name}
    >
      {initials(participant.name)}
    </span>
  );
}

export function AssignmentPage() {
  const { snapshot, repository } = useEventContext();
  const teams = useMemo(
    () => [...snapshot.teams].sort((left, right) => left.displayOrder - right.displayOrder),
    [snapshot.teams],
  );
  const currentParticipant = nextParticipant(snapshot.participants);
  const [ceremonyParticipant, setCeremonyParticipant] = useState<Participant | null>(null);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [visitedTeamIds, setVisitedTeamIds] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<RevealResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reducedMotion] = useState(prefersReducedMotion);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const timer of timersRef.current) clearTimeout(timer);
      timersRef.current.clear();
    };
  }, []);

  const wait = (milliseconds: number) => new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      resolve();
    }, milliseconds);
    timersRef.current.add(timer);
  });

  async function launchReveal() {
    if (busyRef.current || !currentParticipant || teams.length === 0) return;

    busyRef.current = true;
    setBusy(true);
    setError(null);
    setResult(null);
    setCeremonyParticipant(currentParticipant);
    setActiveTeamId(null);
    setVisitedTeamIds(new Set());

    const revealOutcome = repository
      .revealParticipant(snapshot.event.id, currentParticipant.id)
      .then((value) => ({ ok: true as const, value }))
      .catch((reason: unknown) => ({ ok: false as const, reason }));

    const outcome = await revealOutcome;
    if (!mountedRef.current) return;

    if (!outcome.ok) {
      setActiveTeamId(null);
      setCeremonyParticipant(null);
      setError("Attribution impossible. Vous pouvez réessayer.");
      busyRef.current = false;
      setBusy(false);
      return;
    }

    if (!teams.some((team) => team.id === outcome.value.teamId)) {
      setActiveTeamId(null);
      setCeremonyParticipant(null);
      setError("Attribution impossible. Vous pouvez réessayer.");
      busyRef.current = false;
      setBusy(false);
      return;
    }

    if (reducedMotion) {
      setVisitedTeamIds(new Set(teams.map((team) => team.id)));
    } else {
      const sequence = buildReelSequence(teams.map((team) => team.id), outcome.value.teamId);
      for (const step of sequence) {
        await wait(step.delayMs);
        if (!mountedRef.current) return;
        setActiveTeamId(step.teamId);
        setVisitedTeamIds((visited) => new Set(visited).add(step.teamId));
      }
    }

    setActiveTeamId(outcome.value.teamId);
    setResult({ participant: currentParticipant, teamId: outcome.value.teamId });
    setCeremonyParticipant(null);
    busyRef.current = false;
    setBusy(false);
  }

  function showNextParticipant() {
    setResult(null);
    setActiveTeamId(null);
    setVisitedTeamIds(new Set());
  }

  const displayedParticipant = ceremonyParticipant ?? currentParticipant;
  const resultTeam = result ? teams.find((team) => team.id === result.teamId) ?? null : null;

  return (
    <section className="assignment-page" aria-labelledby="assignment-title">
      <header className="assignment-page__heading">
        <p className="assignment-page__eyebrow">La cérémonie des emblèmes</p>
        <h1 id="assignment-title">Attribution des équipes</h1>
        <p>Chaque destin est déjà écrit. La roue va maintenant le révéler.</p>
      </header>

      <div className="assignment-stage">
        <div className="assignment-stage__participant">
          {displayedParticipant ? (
            <>
              <ParticipantPortrait participant={displayedParticipant} />
              <h2>{displayedParticipant.name}</h2>
              <button className="assignment-stage__button" type="button" disabled={busy || result !== null} onClick={launchReveal}>
                {error ? "Réessayer" : busy ? "Les emblèmes délibèrent…" : "Lancer l’attribution"}
              </button>
            </>
          ) : (
            <p className="assignment-stage__complete" role="status">Tous les participants ont été attribués.</p>
          )}
          {error && <p className="assignment-stage__error" role="alert">{error}</p>}
        </div>

        <TeamReel
          teams={teams}
          activeTeamId={activeTeamId}
          visitedTeamIds={visitedTeamIds}
          reducedMotion={reducedMotion}
        />
      </div>

      <section className="team-compositions" role="region" aria-label="Composition des équipes">
        {teams.map((team) => {
          const members = snapshot.participants
            .filter((participant) => participant.revealedTeamId === team.id)
            .sort((left, right) => left.revealOrder - right.revealOrder);
          return (
            <article
              className="team-composition"
              data-testid="team-composition"
              aria-label={`Composition ${team.name}`}
              key={team.id}
              style={{ "--team-color": team.color } as React.CSSProperties}
            >
              <h2><span aria-hidden="true">{team.emblem}</span> {team.name}</h2>
              <div className="team-composition__members">
                {members.map((participant) => (
                  <ParticipantToken
                    key={participant.id}
                    participant={participant}
                    team={team}
                    isNew={!reducedMotion && result?.participant.id === participant.id}
                  />
                ))}
                {members.length === 0 && <span className="team-composition__empty">En attente…</span>}
              </div>
            </article>
          );
        })}
      </section>

      {result && resultTeam && (
        <div className="assignment-result-overlay" role="dialog" aria-modal="true" aria-label={`Attribution de ${result.participant.name}`}>
          <div className="assignment-result-overlay__light" aria-hidden="true" />
          <div className="assignment-result-overlay__card" data-testid="assignment-result">
            <span className="assignment-result-overlay__emblem" aria-hidden="true">{resultTeam.emblem}</span>
            <ParticipantPortrait participant={result.participant} className="assignment-result-overlay__portrait" />
            <p className="assignment-result-overlay__name">{result.participant.name}</p>
            <p className="assignment-result-overlay__joins">rejoint</p>
            <strong>{resultTeam.name}</strong>
            <button type="button" onClick={showNextParticipant}>Participant suivant</button>
          </div>
        </div>
      )}
    </section>
  );
}
