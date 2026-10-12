import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "../components/PublicLayout";
import { AssignmentPage } from "../features/assignment/AssignmentPage";
import { ChallengesPage } from "../features/challenges/ChallengesPage";
import { RankingPage } from "../features/ranking/RankingPage";
import { QuizPage } from "../features/quiz/QuizPage";
import { AdminApp } from "../features/admin/AdminApp";
import type { AdminClient } from "../features/admin/useAdminSession";

type AppProps = {
  basename?: string;
  adminAuth?: AdminClient;
};

export function App({ basename = import.meta.env.BASE_URL, adminAuth }: AppProps) {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/admin/*" element={<AdminApp auth={adminAuth} />} />
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
