import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useOptionalEventContext } from "../../app/AppProviders";
import type { AdminParticipant } from "../../domain/types";
import { AdminLayout } from "./AdminLayout";
import { EventEditor } from "./EventEditor";
import { LoginPage } from "./LoginPage";
import { ParticipantsEditor } from "./ParticipantsEditor";
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

function AdminWorkspace() {
  const context = useOptionalEventContext();
  const [participants, setParticipants] = useState<AdminParticipant[]>([]);

  const refreshParticipants = async () => {
    if (!context) return;
    try {
      setParticipants(await context.repository.getAdminParticipants(context.snapshot.event.id));
    } catch {
      setParticipants([]);
    }
  };

  useEffect(() => {
    void refreshParticipants();
  }, [context?.repository, context?.snapshot.event.id, context?.snapshot.participants]);

  const eventRoute = context ? (
    <EventEditor
      event={context.snapshot.event}
      onSave={(event) => context.repository.updateEvent(event)}
      uploadBackground={(file, eventId) => context.repository.uploadEventBackground(file, eventId)}
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
    <ParticipantsEditor
      eventId={context.snapshot.event.id}
      teams={context.snapshot.teams}
      participants={participants}
      onCreate={async (input) => { await context.repository.createParticipant(input); await refreshParticipants(); }}
      onUpdate={async (participant) => { await context.repository.updateParticipant(participant); await refreshParticipants(); }}
      onDelete={async (eventId, participantId) => { await context.repository.deleteParticipant(eventId, participantId); await refreshParticipants(); }}
      onReorder={async (eventId, participantIds) => { await context.repository.reorderParticipants(eventId, participantIds); await refreshParticipants(); }}
      onResetReveals={async (eventId) => { await context.repository.resetParticipantReveals(eventId); await refreshParticipants(); }}
      uploadPhoto={(file, eventId, participantId) => context.repository.uploadParticipantPhoto(file, eventId, participantId)}
    />
  ) : <Placeholder title="Gestion des participants" />;

  return (
    <Routes>
      <Route path="/admin" element={<section><h2>Tableau de bord</h2><p>Sélectionnez une rubrique pour préparer et piloter l’événement.</p></section>} />
      <Route path="/admin/evenement" element={eventRoute} />
      <Route path="/admin/equipes" element={teamsRoute} />
      <Route path="/admin/participants" element={participantsRoute} />
      <Route path="/admin/defis" element={<Placeholder title="Défis" />} />
      <Route path="/admin/quiz" element={<Placeholder title="Quiz" />} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
