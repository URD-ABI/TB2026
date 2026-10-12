import { useEffect, useState } from "react";
import type { Challenge } from "../../domain/types";
import { ChallengeTile } from "./ChallengeTile";

type ChallengesCarouselProps = {
  challenges: Challenge[];
};

function wrappedIndex(index: number, length: number): number {
  return (index + length) % length;
}

export function ChallengesCarousel({ challenges }: ChallengesCarouselProps) {
  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [timerVersion, setTimerVersion] = useState(0);

  useEffect(() => {
    if (challenges.length <= 1 || paused || hovered || focusWithin) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => wrappedIndex(current + 1, challenges.length));
    }, 7_000);

    return () => window.clearInterval(timer);
  }, [challenges.length, focusWithin, hovered, paused, timerVersion]);

  if (challenges.length === 0) {
    return <p className="challenges-carousel__empty">Aucun défi n’est encore disponible.</p>;
  }

  const safeIndex = Math.min(activeIndex, challenges.length - 1);
  const activeChallenge = challenges[safeIndex];
  const hasNavigation = challenges.length > 1;

  const showChallenge = (index: number) => {
    setActiveIndex(wrappedIndex(index, challenges.length));
    setTimerVersion((current) => current + 1);
  };

  const showPrevious = () => showChallenge(safeIndex - 1);
  const showNext = () => showChallenge(safeIndex + 1);

  return (
    <section
      className="challenges-carousel"
      aria-label="Carrousel des défis"
      aria-roledescription="carrousel"
      data-motion={prefersReducedMotion ? "reduced" : "full"}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusWithin(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          showPrevious();
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          showNext();
        }
      }}
    >
      <p className="visually-hidden" aria-live="polite">
        Défi {safeIndex + 1} sur {challenges.length}
      </p>

      <div className="challenges-carousel__stage">
        <ChallengeTile
          key={activeChallenge.id}
          challenge={activeChallenge}
          number={safeIndex + 1}
        />
      </div>

      {hasNavigation ? (
        <div className="challenges-carousel__controls">
          <button type="button" className="challenges-carousel__arrow" aria-label="Défi précédent" onClick={showPrevious}>‹</button>
          <div className="challenges-carousel__indicators" aria-label="Choisir un défi">
            {challenges.map((challenge, index) => (
              <button
                key={challenge.id}
                type="button"
                className="challenges-carousel__indicator"
                aria-label={`Afficher le défi ${index + 1} : ${challenge.title}`}
                aria-current={index === safeIndex ? "true" : undefined}
                onClick={() => showChallenge(index)}
              >
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
          <button type="button" className="challenges-carousel__arrow" aria-label="Défi suivant" onClick={showNext}>›</button>
          <button
            type="button"
            className="challenges-carousel__toggle"
            aria-label={paused ? "Relancer le carrousel" : "Mettre le carrousel en pause"}
            onClick={() => setPaused((current) => !current)}
          >
            <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
