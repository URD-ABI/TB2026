import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminQuizQuestion, QuizCategory } from "../../domain/types";
import { QuizEditor } from "./QuizEditor";

const categories: QuizCategory[] = Array.from({ length: 6 }, (_, index) => ({
  id: `category-${index + 1}`,
  eventId: "event-1",
  title: `Thème ${index + 1}`,
  imageUrl: null,
  displayOrder: index,
  status: "available",
  chosenByTeamId: null,
}));
const questions: AdminQuizQuestion[] = [{
  id: "question-1", categoryId: "category-1", prompt: "Question ?", answer: "Réponse", points: 10, displayOrder: 0,
}];

describe("QuizEditor", () => {
  const props = {
    categories,
    questions,
    onSaveCategory: vi.fn(),
    onReorderCategories: vi.fn(),
    onCreateQuestion: vi.fn(),
    onUpdateQuestion: vi.fn(),
    onDeleteQuestion: vi.fn(),
    onReorderQuestions: vi.fn(),
    uploadCategoryImage: vi.fn(),
  };

  it("maintient exactement six thèmes", () => {
    render(<QuizEditor {...props} />);
    expect(screen.getAllByRole("group", { name: /thème \d/i })).toHaveLength(6);
  });

  it("refuse un barème nul ou négatif", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...props} />);
    await user.clear(screen.getByLabelText("Points"));
    await user.type(screen.getByLabelText("Points"), "0");
    await user.click(screen.getByRole("button", { name: "Enregistrer la question" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/strictement positif/i);
    expect(props.onUpdateQuestion).not.toHaveBeenCalled();
  });

  it("explique pourquoi une question déjà utilisée ne peut pas être supprimée", async () => {
    const user = userEvent.setup();
    const onDeleteQuestion = vi.fn().mockRejectedValue(new Error("question_already_used"));
    render(<QuizEditor {...props} onDeleteQuestion={onDeleteQuestion} />);
    await user.click(screen.getByRole("button", { name: "Supprimer la question" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/déjà été utilisée/i);
  });
});
