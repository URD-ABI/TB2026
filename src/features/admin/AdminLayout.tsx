import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

type AdminLayoutProps = {
  onSignOut(): Promise<void>;
  signOutPending: boolean;
  signOutError: boolean;
  children?: ReactNode;
};

const sections = [
  { label: "Événement", to: "/admin/evenement" },
  { label: "Équipes et scores", to: "/admin/equipes" },
  { label: "Participants", to: "/admin/participants" },
  { label: "Défis", to: "/admin/defis" },
  { label: "Quiz", to: "/admin/quiz" },
] as const;

export function AdminLayout({ onSignOut, signOutPending, signOutError, children }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Espace organisateur</p>
          <h1>Administration</h1>
        </div>
        <button
          className="admin-sign-out"
          type="button"
          disabled={signOutPending}
          onClick={() => void onSignOut()}
        >
          {signOutPending ? "Déconnexion en cours…" : "Se déconnecter"}
        </button>
      </header>

      {signOutError ? (
        <p className="admin-alert admin-shell__alert" role="alert">
          Déconnexion impossible. Réessayez.
        </p>
      ) : null}

      <nav className="admin-navigation" aria-label="Administration">
        {sections.map((section) => (
          <NavLink
            className={({ isActive }) => isActive ? "admin-navigation__link is-active" : "admin-navigation__link"}
            key={section.to}
            to={section.to}
          >
            {section.label}
          </NavLink>
        ))}
      </nav>

      <main className="admin-content">
        {children ?? <section aria-labelledby="admin-section-title">
          <h2 id="admin-section-title">Tableau de bord</h2>
          <p>Sélectionnez une rubrique pour préparer et piloter l’événement.</p>
        </section>}
      </main>
    </div>
  );
}
