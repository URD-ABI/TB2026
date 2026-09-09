import { supabase } from "../../lib/supabase";
import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useOptionalEventContext } from "../../app/AppProviders";
import type { AdminParticipant, AdminQuizQuestion } from "../../domain/types";
import { AdminLayout } from "./AdminLayout";
import { ChallengesEditor } from "./ChallengesEditor";
import { EventEditor } from "./EventEditor";
import { LoginPage } from "./LoginPage";
import { ParticipantsEditor } from "./ParticipantsEditor";
import { QuizControlPanel } from "./QuizControlPanel";
import { QuizEditor } from "./QuizEditor";
import { TeamsEditor } from "./TeamsEditor";
import { useAdminSession, type AdminClient } from "./useAdminSession";
import "./admin.css";

type AdminAppProps = {
  auth?: AdminClient;
};

export function AdminApp({ auth = supabase as unknown as AdminClient }: AdminAppProps) {
  const session = useAdminSession(auth);

  if (session.loading) {
    return (
      <main className="admin-loading">
        <p role="status" aria-label="Vérification de l’accès administrateur">
          Vérification de l’accès administrateur…
        </p>
      </main>
    );
  }

  if (!session.user || !session.isAdmin) {
    return (
      <LoginPage
        pending={session.signInPending}
        error={session.error === "signout" ? null : session.error}
        onSignIn={session.signIn}
      />
    );
  }

  return (
    <AdminLayout
      onSignOut={session.signOut}
      signOutPending={session.signOutPending}
      signOutError={session.error === "signout"}
    >
      <AdminWorkspace />
    </AdminLayout>
  );
}

function Placeholder({ title }: { title: string }) {
  return <section className="admin-editor"><h2>{title}</h2><p>Cette rubrique sera disponible à l’étape suivante.</p></section>;
}

export function AdminWorkspace() {
  const context = useOptionalEventContext();
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);
  const [participantsLoadError, setParticipantsLoadError] = useState(false);
  const [adminQuestions, setAdminQuestions] = useState<AdminQuizQuestion[]>([]);
  const [quizLoadError, setQuizLoadError] = useState(false);
  const [mediaCleanupError, setMediaCleanupError] = useState(false);
  const participantRequestVersion = useRef(0);

  const cleanupMedia = async () => {
    if (!context) return;
    try {
      await context.repository.cleanupPendingMedia(context.snapshot.event.id);
      setMediaCleanupError(false);
    } catch {
      setMediaCleanupError(true);
    }
  };

  const refreshParticipants = async () => {
    if (!context) return;
    const requestVersion = ++participantRequestVersion.current;
    try {
      const nextParticipants = await context.repository.getAdminParticipants(context.snapshot.event.id);
      if (requestVersion !== participantRequestVersion.current) return;
      setParticipants(nextParticipants);
      setParticipantsLoadError(false);
    } catch {
      if (requestVersion === participantRequestVersion.current) setParticipantsLoadError(true);
    }
  };

  const refreshQuizQuestions = async () => {
    if (!context) return;
    try {
      setAdminQuestions(await context.repository.getAdminQuizQuestions(context.snapshot.event.id));
      setQuizLoadError(false);
    } catch { setQuizLoadError(true); }
  };

  useEffect(() => {
    void refreshParticipants();
    return () => { participantRequestVersion.current += 1; };
  }, [context?.repository, context?.snapshot.event.id, context?.snapshot.participants]);

  useEffect(() => {
    void cleanupMedia();
  }, [context?.repository, context?.snapshot.event.id]);

  useEffect(() => { void refreshQuizQuestions(); }, [context?.repository, context?.snapshot.event.id, context?.snapshot.questions]);

  const eventRoute = context ? (
    <EventEditor
      event={context.snapshot.event}
      onSave={async (event) => {
        await context.repository.updateEvent(event);
        void cleanupMedia();
      }}
      uploadBackground={(file, eventId) => context.repository.uploadEventBackground(file, eventId)}
      removeMedia={(url) => context.repository.removeMedia(url)}
    />
  ) : <Placeholder title="Paramètres de l’événement" />;

  const teamsRoute = context ? (
    <TeamsEditor
      teams={context.snapshot.teams}
      onSaveTeam={(team) => context.repository.updateTeam(team)}
      applyScore={(input) => context.repository.applyScore(input)}
      onSaveTieBreak={(eventId, teamIds) => context.repository.setTeamTieBreakOrder(eventId, teamIds)}
    />
  ) : <Placeholder title="Équipes et scores" />;

  const participantsRoute = context ? (
    <>
      {participantsLoadError ? <p className="admin-alert" role="alert">Chargement des participants impossible. Réessayez.</p> : null}
      <ParticipantsEditor
      eventId={context.snapshot.event.id}
      teams={context.snapshot.teams}
      participants={participants}
      onCreate={async (input) => { await context.repository.createParticipant(input); await refreshParticipants(); }}
      onUpdate={async (participant) => { await context.repository.updateParticipant(participant); await refreshParticipants(); void cleanupMedia(); }}
      onDelete={async (eventId, participantId) => { await context.repository.deleteParticipant(eventId, participantId); await refreshParticipants(); }}
      onReorder={async (eventId, participantIds) => { await context.repository.reorderParticipants(eventId, participantIds); await refreshParticipants(); }}
      onResetReveals={async (eventId) => { await context.repository.resetParticipantReveals(eventId); await refreshParticipants(); }}
      uploadPhoto={(file, eventId, participantId) => context.repository.uploadParticipantPhoto(file, eventId, participantId)}
      removeMedia={(url) => context.repository.removeMedia(url)}
      />
    </>
  ) : <Placeholder title="Gestion des participants" />;

  const challengesRoute = context ? <ChallengesEditor
    challenges={context.snapshot.challenges}
    onSave={async (challenge) => { await context.repository.updateChallenge(challenge); void cleanupMedia(); }}
    onReorder={(eventId, ids) => context.repository.reorderChallenges(eventId, ids)}
    uploadImage={(file, eventId, challengeId) => context.repository.uploadChallengeImage(file, eventId, challengeId)}
    removeMedia={(url) => context.repository.removeMedia(url)}
  /> : <Placeholder title="Défis" />;

  const quizRoute = context ? <>
    {quizLoadError ? <p className="admin-alert" role="alert">Chargement des réponses du quiz impossible. Réessayez.</p> : null}
    <QuizControlPanel
      event={context.snapshot.event} teams={context.snapshot.teams} categories={context.snapshot.categories}
      questions={context.snapshot.questions} session={context.snapshot.quizSession}
      onToggleAccess={(enabled) => context.repository.updateEvent({ ...context.snapshot.event, quizEnabled: enabled })}
      onStart={(eventId) => context.repository.startQuiz(eventId)}
      onReveal={(sessionId, questionId) => context.repository.revealQuizAnswer(sessionId, questionId)}
      onAnswer={(sessionId, questionId, correct, key) => context.repository.answerQuizQuestion(sessionId, questionId, correct, key)}
    />
    <QuizEditor
      categories={context.snapshot.categories} questions={adminQuestions}
      onSaveCategory={async (category) => { await context.repository.updateQuizCategory(category); void cleanupMedia(); }}
      onReorderCategories={(eventId, ids) => context.repository.reorderQuizCategories(eventId, ids)}
      onCreateQuestion={async (input) => { await context.repository.createQuizQuestion(input); await refreshQuizQuestions(); }}
      onUpdateQuestion={async (question) => { await context.repository.updateQuizQuestion(question); await refreshQuizQuestions(); }}
      onDeleteQuestion={async (questionId) => { await context.repository.deleteQuizQuestion(questionId); await refreshQuizQuestions(); }}
      onReorderQuestions={async (categoryId, ids) => { await context.repository.reorderQuizQuestions(categoryId, ids); await refreshQuizQuestions(); }}
      uploadCategoryImage={(file, eventId, categoryId) => context.repository.uploadQuizCategoryImage(file, eventId, categoryId)}
      removeMedia={(url) => context.repository.removeMedia(url)}
    />
  </> : <Placeholder title="Quiz" />;

  return (
    <>
      {mediaCleanupError ? (
        <div className="admin-alert" role="alert">
          Nettoyage des médias impossible. Réessayez.
          <button type="button" onClick={() => void cleanupMedia()}>Réessayer le nettoyage</button>
        </div>
      ) : null}
      <Routes>
      <Route path="/admin" element={<section><h2>Tableau de bord</h2><p>Sélectionnez une rubrique pour préparer et piloter l’événement.</p></section>} />
      <Route path="/admin/evenement" element={eventRoute} />
      <Route path="/admin/equipes" element={teamsRoute} />
      <Route path="/admin/participants" element={participantsRoute} />
      <Route path="/admin/defis" element={challengesRoute} />
      <Route path="/admin/quiz" element={quizRoute} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </>
  );
}
