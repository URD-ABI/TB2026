import type { QuizCategory, QuizQuestion, Team } from "../../domain/types";

type QuestionStageProps = {
  category: QuizCategory;
  question: QuizQuestion;
  team: Team;
  answerVisible: boolean;
  revealedAnswer: string | null;
};

export function QuestionStage({ category, question, team, answerVisible, revealedAnswer }: QuestionStageProps) {
  return (
    <section className="question-stage" aria-labelledby="question-title">
      <p className="question-stage__turn">Au tour de l’équipe {team.name}</p>
      <p className="question-stage__category">{category.title}</p>
      <h1 id="question-title">{question.prompt}</h1>
      <p className="question-stage__points">{question.points} points</p>
      {answerVisible && revealedAnswer !== null ? (
        <aside className="question-stage__answer" aria-live="polite">
          <span>Réponse</span>
          <strong>{revealedAnswer}</strong>
        </aside>
      ) : null}
    </section>
  );
}
