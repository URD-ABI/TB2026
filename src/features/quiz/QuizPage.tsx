import { useEffect, useMemo, useState } from "react";
import { useEventContext } from "../../app/AppProviders";
import type { QuizCategory } from "../../domain/types";
import { canChooseCategory } from "../../domain/quiz";
import { CategoryGrid } from "./CategoryGrid";
import { QuestionStage } from "./QuestionStage";
import "./quiz.css";

export function QuizPage() {
  const { snapshot, repository } = useEventContext();
  const { event, teams, categories, questions, choices, quizSession } = snapshot;
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(null);
  const [optimisticCategoryId, setOptimisticCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingChoiceId, setPendingChoiceId] = useState<string | null>(null);
  const [optimisticChoiceId, setOptimisticChoiceId] = useState<string | null>(null);
  const [unsyncedChoiceId, setUnsyncedChoiceId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);

  useEffect(() => {
    if (optimisticCategoryId !== null && quizSession?.activeCategoryId === optimisticCategoryId) {
      setOptimisticCategoryId(null);
    }
  }, [optimisticCategoryId, quizSession?.activeCategoryId]);

  useEffect(() => {
    const confirmedChoiceId = quizSession?.selectedChoiceId ?? null;
    if (confirmedChoiceId !== null && (confirmedChoiceId === optimisticChoiceId || confirmedChoiceId === unsyncedChoiceId)) {
      setOptimisticChoiceId(null);
      setUnsyncedChoiceId(null);
      setSelectionError(null);
    }
  }, [optimisticChoiceId, quizSession?.selectedChoiceId, unsyncedChoiceId]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const currentTeamId = quizSession?.teamOrder[quizSession.currentTeamIndex];
  const currentTeam = currentTeamId ? teamById.get(currentTeamId) : undefined;
  const activeCategoryId = quizSession?.activeCategoryId ?? optimisticCategoryId;
  const activeCategory = categories.find((category) => category.id === activeCategoryId);
  const categoryQuestions = activeCategory
    ? questions.filter((question) => question.categoryId === activeCategory.id)
      .sort((left, right) => left.displayOrder - right.displayOrder)
    : [];
  const activeQuestion = categoryQuestions[quizSession?.activeQuestionIndex ?? 0];
  const activeChoices = activeQuestion
    ? choices.filter((choice) => choice.questionId === activeQuestion.id)
    : [];

  if (!event.quizEnabled) {
    return <section className="quiz-notice" role="status">Le quiz n’est pas encore accessible.</section>;
  }
  if (!quizSession || quizSession.startedAt === null) {
    return <section className="quiz-notice" role="status">Le quiz sera lancé par l’organisateur.</section>;
  }
  if (quizSession.currentTeamIndex >= quizSession.teamOrder.length) {
    return <section className="quiz-notice" role="status">Quiz terminé. Bravo à toutes les équipes !</section>;
  }
  if (!currentTeam) {
    return <section className="quiz-notice" role="status">L’équipe courante est introuvable.</section>;
  }

  if (activeCategory && activeQuestion) {
    const displayedChoiceId = pendingChoiceId ?? unsyncedChoiceId ?? optimisticChoiceId ?? quizSession.selectedChoiceId;
    const selectChoice = async (choiceId: string) => {
      setPendingChoiceId(choiceId);
      setOptimisticChoiceId(choiceId);
      setUnsyncedChoiceId(null);
      setSelectionError(null);
      try {
        await repository.selectQuizChoice(quizSession.id, activeQuestion.id, choiceId);
      } catch {
        setOptimisticChoiceId(null);
        setUnsyncedChoiceId(choiceId);
        setSelectionError("Sélection non synchronisée, réessayez.");
      } finally {
        setPendingChoiceId(null);
      }
    };
    return (
      <QuestionStage
        category={activeCategory}
        question={activeQuestion}
        choices={activeChoices}
        team={currentTeam}
        selectedChoiceId={displayedChoiceId}
        choiceLocked={quizSession.choiceLocked}
        answerVisible={quizSession.answerVisible}
        revealedChoiceId={quizSession.revealedChoiceId}
        selectionPending={pendingChoiceId !== null}
        selectionError={selectionError}
        onSelect={(choiceId) => void selectChoice(choiceId)}
        onRetry={() => { if (unsyncedChoiceId) void selectChoice(unsyncedChoiceId); }}
      />
    );
  }

  const chosenTeamIds = categories.flatMap((category) => category.chosenByTeamId ? [category.chosenByTeamId] : []);
  const choose = async (category: QuizCategory) => {
    setPendingCategoryId(category.id);
    setError(null);
    try {
      await repository.chooseQuizCategory({
        eventId: event.id,
        sessionId: quizSession.id,
        teamId: currentTeam.id,
        categoryId: category.id,
      });
      setOptimisticCategoryId(category.id);
    } catch {
      setError("Ce thème ne peut plus être choisi. Le tableau va se mettre à jour.");
    } finally {
      setPendingCategoryId(null);
    }
  };

  return (
    <section className="quiz-page" aria-labelledby="quiz-title">
      <header className="quiz-page__header">
        <p>Le cercle des savoirs</p>
        <h1 id="quiz-title">Au tour de l’équipe {currentTeam.name}</h1>
        <span>Choisissez votre thème</span>
      </header>
      {error ? <p className="quiz-page__error" role="alert">{error}</p> : null}
      <CategoryGrid
        categories={categories}
        pendingCategoryId={pendingCategoryId}
        disabled={(category) => !canChooseCategory(category, chosenTeamIds, currentTeam.id)}
        onChoose={(category) => void choose(category)}
      />
    </section>
  );
}
