import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { AssignmentPage } from "../features/assignment/AssignmentPage";
import { ChallengesPage } from "../features/challenges/ChallengesPage";
import { RankingPage } from "../features/ranking/RankingPage";
import { QuizPage } from "../features/quiz/QuizPage";

type AppProps = {
  basename?: string;
};

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
          <Route path="attribution" element={<AssignmentPage />} />
          <Route path="defis" element={<ChallengesPage />} />
          <Route path="quiz/*" element={<QuizPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
