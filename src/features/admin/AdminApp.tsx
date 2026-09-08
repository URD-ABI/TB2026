import { supabase } from "../../lib/supabase";
import { AdminLayout } from "./AdminLayout";
import { LoginPage } from "./LoginPage";
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
    />
  );
}
