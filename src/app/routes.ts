export const appRoutes = {
  ranking: "/",
  assignment: "/attribution",
  challenges: "/defis",
  quiz: "/quiz",
  admin: "/admin",
} as const;

export type PublicNavigationItem = {
  label: string;
  to: string;
  end?: boolean;
};

const permanentNavigation: PublicNavigationItem[] = [
  { label: "Classement", to: appRoutes.ranking, end: true },
  { label: "Attribution", to: appRoutes.assignment },
  { label: "Défis", to: appRoutes.challenges },
];

export function getPublicNavigation(quizEnabled: boolean): PublicNavigationItem[] {
  return quizEnabled
    ? [...permanentNavigation, { label: "Quiz", to: appRoutes.quiz }]
    : [...permanentNavigation];
}
