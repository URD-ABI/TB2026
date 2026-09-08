import type { CSSProperties } from "react";
import type { Challenge } from "../../domain/types";
import { toSafeCssBackground } from "../../lib/cssBackground";

type ChallengeStyle = CSSProperties & {
  "--challenge-image"?: string;
};

type ChallengeTileProps = {
  challenge: Challenge;
  number: number;
  featured: boolean;
};

export function ChallengeTile({ challenge, number, featured }: ChallengeTileProps) {
  const background = toSafeCssBackground(challenge.imageUrl);
  const style: ChallengeStyle | undefined = background
    ? { "--challenge-image": background }
    : undefined;
  const titleId = `challenge-title-${challenge.id}`;
  const className = [
    "challenge-tile",
    featured ? "challenge-tile--featured" : "",
    background ? "" : "challenge-tile--fallback",
  ].filter(Boolean).join(" ");

  return (
    <article
      className={className}
      aria-labelledby={titleId}
      data-testid="challenge-tile"
      style={style}
    >
      {!background && (
        <div className="challenge-tile__fallback" data-testid="challenge-fallback" aria-hidden="true">
          <span>✦</span>
        </div>
      )}
      <div className="challenge-tile__veil" aria-hidden="true" />
      <div className="challenge-tile__content">
        <div className="challenge-tile__meta">
          <span className="challenge-tile__number" data-testid="challenge-number">
            {String(number).padStart(2, "0")}
          </span>
          <span className="challenge-tile__kind">{challenge.kind}</span>
        </div>
        <h2 id={titleId}>{challenge.title}</h2>
        <p>{challenge.description}</p>
      </div>
    </article>
  );
}
