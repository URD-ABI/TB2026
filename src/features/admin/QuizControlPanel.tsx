import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { EventConfig, QuizCategory, QuizChoice, QuizQuestion, QuizSession, Team } from "../../domain/types";
import { freezeQuizOrder } from "../../domain/quiz";

type Props = {
  event: EventConfig; teams: Team[]; categories: QuizCategory[]; questions: QuizQuestion[]; choices: QuizChoice[]; session: QuizSession | null;
  onToggleAccess(enabled: boolean): Promise<void>;
  onStart(eventId: string): Promise<void>;
  onLock(sessionId: string, questionId: string): Promise<void>;
  onRevealAndScore(sessionId: string, questionId: string): Promise<void>;
  onAdvance(sessionId: string, questionId: string): Promise<void>;
  onReset(eventId: string): Promise<void>;
};

export function QuizControlPanel(props: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const resetReturnFocus = useRef<HTMLButtonElement | null>(null);
  const busy = pending || resetState === "saving";
  const tieBreakRequired = useMemo(() => { try { freezeQuizOrder(props.teams); return false; } catch { return true; } }, [props.teams]);
  const session = props.session;
  const category = props.categories.find((item) => item.id === session?.activeCategoryId);
  const categoryQuestions = props.questions.filter((item) => item.categoryId === category?.id).sort((a, b) => a.displayOrder - b.displayOrder);
  const question = categoryQuestions[session?.activeQuestionIndex ?? 0];
  const selectedChoice = props.choices.find((choice) => choice.id === session?.selectedChoiceId);
  const revealedChoice = props.choices.find((choice) => choice.id === session?.revealedChoiceId);
  const team = props.teams.find((item) => item.id === session?.teamOrder[session.currentTeamIndex]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setPending(true); setError(null);
    try { await action(); } catch { setError("Commande du quiz impossible. Réessayez."); }
    finally { setPending(false); }
  };
  const cancelReset = () => {
    if (resetState === "saving") return;
    setConfirmingReset(false);
    setResetState("idle");
    resetReturnFocus.current?.focus();
  };
  const reset = async () => {
    if (busy) return;
    setResetState("saving");
    setError(null);
    try {
      await props.onReset(props.event.id);
      setConfirmingReset(false);
      setResetState("saved");
    } catch {
      setResetState("error");
    }
  };

  useEffect(() => {
    if (resetState === "saved") resetReturnFocus.current?.focus();
  }, [resetState]);

  return <section className="admin-quiz-control" aria-labelledby="quiz-control-title">
    <h3 id="quiz-control-title">Pilotage en direct</h3>
    <label className="admin-toggle"><input type="checkbox" checked={props.event.quizEnabled} disabled={busy} onChange={(event) => void run(() => props.onToggleAccess(event.target.checked))} />Rendre le quiz accessible aux joueurs</label>
    {!session?.startedAt ? <>
      {tieBreakRequired ? <p className="admin-alert" role="alert">Un départage est requis avant de figer l’ordre.</p> : null}
      <button type="button" disabled={busy || tieBreakRequired || !props.event.quizEnabled} onClick={() => void run(() => props.onStart(props.event.id))}>Démarrer le quiz</button>
    </> : <div className="admin-live-question">
      <p>Au tour de {team?.name ?? "l’équipe suivante"}</p>
      {question ? <>
        <h4>{question.prompt}</h4>
        {selectedChoice ? <p className="admin-live-question__choice">Choix actuel : {choiceLabel(selectedChoice)}</p> : <p className="admin-live-question__waiting">En attente de la réponse de l’équipe.</p>}
        {!session.choiceLocked && !session.answerVisible ? <button type="button" disabled={busy || !selectedChoice} onClick={() => void run(() => props.onLock(session.id, question.id))}>Verrouiller le choix</button> : null}
        {session.choiceLocked && !session.answerVisible ? <button type="button" disabled={busy} onClick={() => void run(() => props.onRevealAndScore(session.id, question.id))}>Révéler la réponse</button> : null}
        {session.answerVisible ? <>
          <p className={session.selectedChoiceId === session.revealedChoiceId ? "admin-live-question__result admin-live-question__result--correct" : "admin-live-question__result admin-live-question__result--wrong"}>
            {session.selectedChoiceId === session.revealedChoiceId ? "Bonne réponse" : "Mauvaise réponse"}
            {revealedChoice ? ` — Solution : ${choiceLabel(revealedChoice)}` : ""}
          </p>
          <button type="button" disabled={busy} onClick={() => void run(() => props.onAdvance(session.id, question.id))}>Question suivante</button>
        </> : null}
      </> : <p>En attente du choix d’un thème par l’équipe.</p>}
    </div>}
    <button
      ref={resetReturnFocus}
      type="button"
      className="admin-danger-button"
      disabled={busy}
      onClick={() => { setConfirmingReset(true); setResetState("idle"); }}
    >Réinitialiser le quiz</button>
    {confirmingReset ? <div
      className="admin-confirm"
      role="dialog"
      aria-modal="true"
      aria-label="Confirmer la réinitialisation du quiz"
      onKeyDown={(event) => {
        if (event.key === "Escape" && resetState !== "saving") cancelReset();
        else trapDialogFocus(event);
      }}
    >
      <p>La progression, les réponses et l’ordre de passage seront effacés.</p>
      <p>Les points attribués par le quiz seront retirés. Les défis, les clés, les thèmes et les questions seront conservés.</p>
      <p>L’accès public au quiz sera désactivé.</p>
      <button autoFocus type="button" disabled={resetState === "saving"} onClick={() => void reset()}>Confirmer la réinitialisation</button>
      <button type="button" disabled={resetState === "saving"} onClick={cancelReset}>Annuler</button>
    </div> : null}
    {resetState === "saved" ? <p className="admin-save-status" role="status">Quiz réinitialisé.</p> : null}
    {resetState === "error" ? <p className="admin-alert" role="alert">Réinitialisation du quiz impossible. Réessayez.</p> : null}
    {error ? <p className="admin-alert" role="alert">{error}</p> : null}
  </section>;
}

function choiceLabel(choice: QuizChoice) {
  return `${String.fromCharCode(65 + choice.displayOrder)} — ${choice.text}`;
}

function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "Tab") return;
  const controls = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const first = controls[0];
  const last = controls.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
