import type { QuizCategory, QuizChoice, QuizQuestion, Team } from "../../domain/types";

type QuestionStageProps = {
  category: QuizCategory;
  question: QuizQuestion;
  choices: QuizChoice[];
  team: Team;
  selectedChoiceId: string | null;
  choiceLocked: boolean;
  answerVisible: boolean;
  revealedChoiceId: string | null;
  selectionPending: boolean;
  selectionError: string | null;
  onSelect(choiceId: string): void;
  onRetry(): void;
};

export function QuestionStage({
  category,
  question,
  choices,
  team,
  selectedChoiceId,
  choiceLocked,
  answerVisible,
  revealedChoiceId,
  selectionPending,
  selectionError,
  onSelect,
  onRetry,
}: QuestionStageProps) {
  const orderedChoices = [...choices].sort((left, right) => left.displayOrder - right.displayOrder);
  const selectedIsCorrect = answerVisible && selectedChoiceId !== null && selectedChoiceId === revealedChoiceId;

  return (
    <section className="question-stage" aria-labelledby="question-title">
      <p className="question-stage__turn">Au tour de l’équipe {team.name}</p>
      <p className="question-stage__category">{category.title}</p>
      <h1 id="question-title">{question.prompt}</h1>
      <p className="question-stage__points">{question.points} points</p>
      <div className="question-stage__choices" aria-label="Réponses possibles">
        {orderedChoices.map((choice) => {
          const letter = String.fromCharCode(65 + choice.displayOrder);
          const selected = choice.id === selectedChoiceId;
          const correct = answerVisible && choice.id === revealedChoiceId;
          const wrong = answerVisible && selected && !correct;
          const classNames = [
            "question-choice",
            selected ? "question-choice--selected" : "",
            correct ? "question-choice--correct" : "",
            wrong ? "question-choice--wrong" : "",
          ].filter(Boolean).join(" ");
          return <button
            type="button"
            className={classNames}
            aria-label={`${letter} — ${choice.text}`}
            aria-pressed={selected}
            disabled={selectionPending || choiceLocked || answerVisible}
            key={choice.id}
            onClick={() => onSelect(choice.id)}
          >
            <span className="question-choice__letter" aria-hidden="true">{letter}</span>
            <span className="question-choice__text" aria-hidden="true">{choice.text}</span>
            {correct ? <span className="question-choice__marker" aria-hidden="true">✓</span> : null}
            {wrong ? <span className="question-choice__marker" aria-hidden="true">✕</span> : null}
          </button>;
        })}
      </div>
      <div className="question-stage__status" aria-live="polite">
        {answerVisible ? <p>{selectedIsCorrect ? "Bonne réponse !" : "Mauvaise réponse. La bonne réponse est indiquée en vert."}</p> : null}
        {!answerVisible && choiceLocked ? <p>Choix verrouillé</p> : null}
        {!answerVisible && !choiceLocked && selectedChoiceId ? <p>Réponse sélectionnée. Vous pouvez encore la modifier.</p> : null}
        {selectionPending ? <p>Enregistrement du choix…</p> : null}
        {selectionError ? <div className="question-stage__sync-error" role="alert"><p>{selectionError}</p><button type="button" onClick={onRetry}>Réessayer la sélection</button></div> : null}
      </div>
    </section>
  );
}
