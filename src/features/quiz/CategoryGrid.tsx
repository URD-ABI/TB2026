import type { QuizCategory } from "../../domain/types";
import type { CSSProperties } from "react";
import { toSafeCssBackground } from "../../lib/cssBackground";

type CategoryGridProps = {
  categories: QuizCategory[];
  disabled: (category: QuizCategory) => boolean;
  pendingCategoryId: string | null;
  onChoose: (category: QuizCategory) => void;
};

export function CategoryGrid({ categories, disabled, pendingCategoryId, onChoose }: CategoryGridProps) {
  return (
    <section className="quiz-categories" aria-label="Thèmes du quiz">
      {categories
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .slice(0, 6)
        .map((category, index) => {
          const background = toSafeCssBackground(category.imageUrl);
          const isPlayed = category.status === "played";
          const isInProgress = !isPlayed && category.chosenByTeamId !== null;
          return <article
            className={`quiz-category${background ? "" : " quiz-category--fallback"}${isPlayed ? " quiz-category--played" : ""}`}
            data-testid="quiz-category"
            key={category.id}
            style={background ? { "--quiz-category-image": background } as CSSProperties : undefined}
          >
            <span className="quiz-category__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            {isPlayed ? (
              <span className="quiz-category__complete" data-testid="quiz-category-complete" aria-hidden="true">✓</span>
            ) : null}
            <button
              className="quiz-category__button"
              type="button"
              disabled={disabled(category) || pendingCategoryId !== null}
              onClick={() => onChoose(category)}
              aria-label={category.title}
            >
              <span>{category.title}</span>
              <small>{isPlayed ? "Thème terminé" : isInProgress ? "Thème en cours" : "Choisir ce thème"}</small>
            </button>
          </article>;
        })}
    </section>
  );
}
