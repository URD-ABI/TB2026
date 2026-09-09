import { useMemo, useState } from "react";
import type { EventConfig, QuizCategory, QuizQuestion, QuizSession, Team } from "../../domain/types";
import { freezeQuizOrder } from "../../domain/quiz";

type Props = {
  event: EventConfig; teams: Team[]; categories: QuizCategory[]; questions: QuizQuestion[]; session: QuizSession | null;
  onToggleAccess(enabled: boolean): Promise<void>;
  onStart(eventId: string): Promise<void>;
  onReveal(sessionId: string, questionId: string): Promise<void>;
  onAnswer(sessionId: string, questionId: string, correct: boolean, idempotencyKey: string): Promise<void>;
};

export function QuizControlPanel(props: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tieBreakRequired = useMemo(() => { try { freezeQuizOrder(props.teams); return false; } catch { return true; } }, [props.teams]);
  const session = props.session;
  const category = props.categories.find((item) => item.id === session?.activeCategoryId);
  const categoryQuestions = props.questions.filter((item) => item.categoryId === category?.id).sort((a, b) => a.displayOrder - b.displayOrder);
  const question = categoryQuestions[session?.activeQuestionIndex ?? 0];
  const team = props.teams.find((item) => item.id === session?.teamOrder[session.currentTeamIndex]);
  const run = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true); setError(null);
    try { await action(); } catch { setError("Commande du quiz impossible. Réessayez."); }
    finally { setPending(false); }
  };

  return <section className="admin-quiz-control" aria-labelledby="quiz-control-title">
    <h3 id="quiz-control-title">Pilotage en direct</h3>
    <label className="admin-toggle"><input type="checkbox" checked={props.event.quizEnabled} disabled={pending} onChange={(event) => void run(() => props.onToggleAccess(event.target.checked))} />Rendre le quiz accessible aux joueurs</label>
    {!session?.startedAt ? <>
      {tieBreakRequired ? <p className="admin-alert" role="alert">Un départage est requis avant de figer l’ordre.</p> : null}
      <button type="button" disabled={pending || tieBreakRequired || !props.event.quizEnabled} onClick={() => void run(() => props.onStart(props.event.id))}>Démarrer le quiz</button>
    </> : <div className="admin-live-question">
      <p>Au tour de {team?.name ?? "l’équipe suivante"}</p>
      {question ? <><h4>{question.prompt}</h4>{session.answerVisible ? <p>Réponse : {session.revealedAnswer}</p> : null}
        <button type="button" disabled={pending || session.answerVisible} onClick={() => void run(() => props.onReveal(session.id, question.id))}>Révéler la réponse</button>
        <button type="button" disabled={pending || !session.answerVisible} onClick={() => void run(() => props.onAnswer(session.id, question.id, true, crypto.randomUUID()))}>Bonne réponse</button>
        <button type="button" disabled={pending || !session.answerVisible} onClick={() => void run(() => props.onAnswer(session.id, question.id, false, crypto.randomUUID()))}>Mauvaise réponse</button></> : <p>En attente du choix d’un thème par l’équipe.</p>}
    </div>}
    {error ? <p className="admin-alert" role="alert">{error}</p> : null}
  </section>;
}
