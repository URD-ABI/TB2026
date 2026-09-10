import { useMemo } from "react";
import { useEventContext } from "../../app/AppProviders";
import { ChallengesCarousel } from "./ChallengesCarousel";
import "./challenges.css";

export function ChallengesPage() {
  const { snapshot } = useEventContext();
  const challenges = useMemo(
    () => [...snapshot.challenges].sort((left, right) => left.displayOrder - right.displayOrder),
    [snapshot.challenges],
  );

  return (
    <section className="challenges-page" aria-labelledby="challenges-title">
      <header className="challenges-page__heading">
        <p className="challenges-page__eyebrow">Les épreuves du tournoi</p>
        <h1 id="challenges-title">Les cinq défis</h1>
        <p>Adresse, esprit d’équipe et audace ouvriront les portes de la forteresse.</p>
      </header>

      <ChallengesCarousel challenges={challenges} />
    </section>
  );
}
