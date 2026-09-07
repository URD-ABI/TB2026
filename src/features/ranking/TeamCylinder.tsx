import type { CSSProperties } from "react";
import type { RankedTeam } from "../../domain/types";

type CylinderStyle = CSSProperties & {
  "--team-color": string;
  "--fill": string;
};

const podiumClass: Record<number, string | undefined> = {
  1: "rank-gold",
  2: "rank-silver",
  3: "rank-bronze",
};

type TeamCylinderProps = {
  entry: RankedTeam;
  maximum: number;
};

export function TeamCylinder({ entry, maximum }: TeamCylinderProps) {
  const { team, rank, requiresTieBreak } = entry;
  const ratio = maximum > 0 ? team.points / maximum : 0;
  const fill = Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const nameId = `team-cylinder-${team.id}-name`;
  const style: CylinderStyle = {
    "--team-color": team.color,
    "--fill": `${fill}%`,
  };
  const classes = ["team-cylinder", `rank-${rank}`, podiumClass[rank]]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      data-testid="team-cylinder"
      aria-labelledby={nameId}
      style={style}
    >
      <div
        className="team-cylinder__rank"
        data-appearance="number-only"
        aria-label={`Place ${rank}`}
      >{rank}</div>

      <div
        className="team-cylinder__glass"
        role="meter"
        aria-label={`Niveau de sable de ${team.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={fill}
        aria-valuetext={`${fill} % du meilleur score`}
      >
        <div className="team-cylinder__grains" aria-hidden="true" />
        <div className="team-cylinder__shine" aria-hidden="true" />
        <strong className="team-cylinder__score">{team.points} points</strong>
      </div>

      <div className="team-cylinder__identity">
        <h2 className="team-cylinder__name" id={nameId}>
          <span className="team-cylinder__emblem" aria-hidden="true">{team.emblem}</span>{" "}
          {team.name}
        </h2>
        <p className="team-cylinder__keys">
          <span aria-hidden="true">⚿</span>{" "}
          {team.keys} {team.keys === 1 ? "clé" : "clés"}
        </p>
        {requiresTieBreak ? (
          <p className="team-cylinder__tie" role="status">Départage requis</p>
        ) : null}
      </div>
    </article>
  );
}
