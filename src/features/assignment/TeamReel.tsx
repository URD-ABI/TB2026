import type { Team } from "../../domain/types";

type TeamReelProps = {
  teams: Team[];
  activeTeamId: string | null;
  visitedTeamIds: ReadonlySet<string>;
  reducedMotion: boolean;
};

export function TeamReel({ teams, activeTeamId, visitedTeamIds, reducedMotion }: TeamReelProps) {
  return (
    <div className="team-reel" data-testid="team-reel" data-motion={reducedMotion ? "reduced" : "full"}>
      <p className="team-reel__incantation">Pique-nique-douille, c’est toi l’andouille</p>
      <ul className="team-reel__list" aria-label="Roue des équipes">
        {teams.map((team) => (
          <li
            className="team-reel__team"
            data-testid="reel-team"
            data-visited={visitedTeamIds.has(team.id) ? "true" : "false"}
            aria-current={activeTeamId === team.id ? "true" : undefined}
            key={team.id}
            style={{ "--team-color": team.color } as React.CSSProperties}
          >
            <span className="team-reel__emblem" aria-hidden="true">{team.emblem}</span>
            <span>{team.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
