import { describe, expect, it } from "vitest";
import seed from "../../supabase/seed.sql?raw";

const categoryIds = [
  "50000000-0000-0000-0000-000000000011",
  "50000000-0000-0000-0000-000000000012",
  "50000000-0000-0000-0000-000000000013",
  "50000000-0000-0000-0000-000000000014",
  "50000000-0000-0000-0000-000000000015",
  "50000000-0000-0000-0000-000000000016",
];

function between(start: string, end: string): string {
  const section = seed.split(start)[1]?.split(end)[0];
  if (!section) throw new Error(`Section SQL introuvable : ${start}`);
  return section;
}

describe("local quiz seed", () => {
  it("définit trois questions ordonnées pour chacun des six thèmes", () => {
    const questions = between(
      "insert into public.quiz_questions",
      "insert into public.quiz_question_answers",
    );

    for (const categoryId of categoryIds) {
      expect(questions.match(new RegExp(categoryId, "g"))).toHaveLength(3);
    }
    expect(questions.match(/'60000000-0000-0000-0000-0000000000\d{2}'/g)).toHaveLength(18);
    expect(questions.match(/, 10, [012]\)/g)).toHaveLength(18);
  });

  it("définit une réponse protégée pour chacune des dix-huit questions", () => {
    const answers = between(
      "insert into public.quiz_question_answers",
      "insert into public.quiz_sessions",
    );
    expect(answers.match(/'60000000-0000-0000-0000-0000000000\d{2}'/g)).toHaveLength(18);
  });
});
