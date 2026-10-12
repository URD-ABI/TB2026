import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  id: "question-1", categoryId: "category-1", prompt: "Question ?", points: 10, displayOrder: 0,
  choices: [
    { id: "choice-a", questionId: "question-1", text: "Une baguette", displayOrder: 0, isCorrect: false },
    { id: "choice-b", questionId: "question-1", text: "Un médaillon", displayOrder: 1, isCorrect: false },
    { id: "choice-c", questionId: "question-1", text: "Une clé", displayOrder: 2, isCorrect: true },
    { id: "choice-d", questionId: "question-1", text: "Un grimoire", displayOrder: 3, isCorrect: false },
  ],
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

  beforeEach(() => vi.clearAllMocks());

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

  it("édite quatre réponses ordonnées et une seule bonne réponse", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...props} />);

    expect(screen.getAllByRole("textbox", { name: /^Réponse [A-D]$/ })).toHaveLength(4);
    expect(screen.getAllByRole("radio", { name: /^Bonne réponse [A-D]$/ })).toHaveLength(4);
    await user.click(screen.getByRole("radio", { name: "Bonne réponse B" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer la question" }));

    expect(props.onUpdateQuestion).toHaveBeenCalledWith(expect.objectContaining({
      choices: expect.arrayContaining([
        expect.objectContaining({ displayOrder: 1, isCorrect: true }),
        expect.objectContaining({ displayOrder: 2, isCorrect: false }),
      ]),
    }));
  });

  it("refuse deux réponses identiques après normalisation", async () => {
    const user = userEvent.setup();
    render(<QuizEditor {...props} />);

    const responseD = screen.getByRole("textbox", { name: "Réponse D" });
    await user.clear(responseD);
    await user.type(responseD, " une CLÉ ");

    expect(screen.getByText("Les quatre réponses doivent être différentes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer la question" })).toBeDisabled();
  });

  it("explique pourquoi une question déjà utilisée ne peut pas être supprimée", async () => {
    const user = userEvent.setup();
    const onDeleteQuestion = vi.fn().mockRejectedValue(new Error("question_already_used"));
    render(<QuizEditor {...props} onDeleteQuestion={onDeleteQuestion} />);
    await user.click(screen.getByRole("button", { name: "Supprimer la question" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/déjà été utilisée/i);
  });
});
