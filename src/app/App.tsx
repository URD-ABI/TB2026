import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { RankingPage } from "../features/ranking/RankingPage";

type AppProps = {
  basename?: string;
};

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="page-placeholder" aria-labelledby={`page-${title}`}>
      <h2 id={`page-${title}`}>{title}</h2>
      <p>{description}</p>
    </section>
  );
}

function AdminPlaceholder() {
  return (
    <main className="admin-page">
      <section className="admin-placeholder" aria-labelledby="admin-title">
        <p className="event-header__eyebrow">Espace organisateur</p>
        <h1 id="admin-title">Administration</h1>
        <p>Les commandes du tournoi seront réunies ici.</p>
      </section>
    </main>
  );
}

export function App({ basename = import.meta.env.BASE_URL }: AppProps) {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/admin/*" element={<AdminPlaceholder />} />
        <Route element={<PublicLayout />}>
          <Route index element={<RankingPage />} />
          <Route path="attribution" element={<PlaceholderPage title="Attribution" description="La cérémonie d’attribution des équipes se prépare." />} />
          <Route path="defis" element={<PlaceholderPage title="Défis" description="Les cinq épreuves du tournoi seront bientôt révélées." />} />
          <Route path="quiz/*" element={<PlaceholderPage title="Quiz" description="Choisissez un thème et remportez des points pour votre équipe." />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
