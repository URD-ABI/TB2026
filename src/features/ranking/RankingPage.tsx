import { useEventContext } from "../../app/AppProviders";
import { rankTeams } from "../../domain/ranking";
import { TeamCylinder } from "./TeamCylinder";
import "./ranking.css";

export function RankingPage() {
  const { snapshot } = useEventContext();
  const entries = rankTeams(snapshot.teams);

  return (
    <section className="ranking-page" aria-labelledby="ranking-title">
      <div className="ranking-page__heading">
        <p className="ranking-page__eyebrow">La coupe des cinq équipes</p>
        <h1 id="ranking-title">Classement</h1>
        <p>Les grains enchantés révèlent la progression de chaque équipe.</p>
      </div>

      <div className="ranking-page__cylinders">
        {entries.map((entry) => (
          <TeamCylinder
            key={entry.team.id}
            entry={entry}
            capacity={snapshot.event.scoreCapacity}
          />
        ))}
      </div>
    </section>
  );
}
