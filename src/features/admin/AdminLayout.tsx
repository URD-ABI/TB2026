import { NavLink } from "react-router-dom";

type AdminLayoutProps = {
  onSignOut(): Promise<void>;
};

const sections = [
  { label: "Événement", to: "/admin/evenement" },
  { label: "Équipes et scores", to: "/admin/equipes" },
  { label: "Participants", to: "/admin/participants" },
  { label: "Défis", to: "/admin/defis" },
  { label: "Quiz", to: "/admin/quiz" },
] as const;

export function AdminLayout({ onSignOut }: AdminLayoutProps) {
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Espace organisateur</p>
          <h1>Administration</h1>
        </div>
        <button className="admin-sign-out" type="button" onClick={() => void onSignOut()}>
          Se déconnecter
        </button>
      </header>

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
        <section aria-labelledby="admin-section-title">
          <h2 id="admin-section-title">Tableau de bord</h2>
          <p>Sélectionnez une rubrique pour préparer et piloter l’événement.</p>
        </section>
      </main>
    </div>
  );
}
