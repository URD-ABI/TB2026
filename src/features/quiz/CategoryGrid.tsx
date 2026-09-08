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
          return <article
            className={`quiz-category${background ? "" : " quiz-category--fallback"}`}
            data-testid="quiz-category"
            key={category.id}
            style={background ? { "--quiz-category-image": background } as CSSProperties : undefined}
          >
            <span className="quiz-category__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <button
              className="quiz-category__button"
              type="button"
              disabled={disabled(category) || pendingCategoryId !== null}
              onClick={() => onChoose(category)}
              aria-label={category.title}
            >
              <span>{category.title}</span>
              {category.status === "played" || category.chosenByTeamId !== null
                ? <small>Thème déjà choisi</small>
                : <small>Choisir ce thème</small>}
            </button>
          </article>;
        })}
    </section>
  );
}
