import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { AdminQuizQuestion, QuizCategory } from "../../domain/types";
import { validateImageFile } from "../../lib/images";

export type CreateQuizQuestionInput = Omit<AdminQuizQuestion, "id">;
type Props = {
  categories: QuizCategory[]; questions: AdminQuizQuestion[];
  onSaveCategory(category: QuizCategory): Promise<void>;
  onReorderCategories(eventId: string, ids: string[]): Promise<void>;
  onCreateQuestion(input: CreateQuizQuestionInput): Promise<void>;
  onUpdateQuestion(question: AdminQuizQuestion): Promise<void>;
  onDeleteQuestion(questionId: string): Promise<void>;
  onReorderQuestions(categoryId: string, ids: string[]): Promise<void>;
  uploadCategoryImage(file: File, eventId: string, categoryId: string): Promise<string>;
  removeMedia?(url: string): Promise<void>;
};

export function QuizEditor(props: Props) {
  const [categories, setCategories] = useState(() => [...props.categories].sort((a, b) => a.displayOrder - b.displayOrder));
  const [questions, setQuestions] = useState(() => [...props.questions]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => setCategories([...props.categories].sort((a, b) => a.displayOrder - b.displayOrder)), [props.categories]);
  useEffect(() => setQuestions([...props.questions]), [props.questions]);
  if (categories.length !== 6) return <section className="admin-editor"><h2>Quiz</h2><p className="admin-alert" role="alert">L’événement doit contenir exactement six thèmes.</p></section>;

  const run = async (action: () => Promise<void>, message = "Enregistrement impossible. Réessayez.") => {
    if (pending) return false;
    setPending(true); setError(null);
    try { await action(); return true; } catch (caught) {
      setError(caught instanceof Error && caught.message.includes("question_already_used") ? "Cette question a déjà été utilisée pendant le quiz et ne peut plus être supprimée." : message);
      return false;
    } finally { setPending(false); }
  };
  const changeCategory = (id: string, patch: Partial<QuizCategory>) => setCategories((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const moveCategory = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const previous = categories; const reordered = [...categories];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const normalized = reordered.map((item, displayOrder) => ({ ...item, displayOrder })); setCategories(normalized);
    if (!await run(() => props.onReorderCategories(normalized[0].eventId, normalized.map((item) => item.id)))) setCategories(previous);
  };
  const uploadCategory = async (event: ChangeEvent<HTMLInputElement>, category: QuizCategory) => {
    const file = event.target.files?.[0]; if (!file) return;
    try { validateImageFile(file); } catch { setError("Choisissez une image JPEG, PNG ou WebP de 10 Mio maximum."); return; }
    let imageUrl: string | null = null;
    await run(async () => {
      imageUrl = await props.uploadCategoryImage(file, category.eventId, category.id);
      try { await props.onSaveCategory({ ...category, imageUrl }); changeCategory(category.id, { imageUrl }); }
      catch (error) { if (imageUrl) { try { await props.removeMedia?.(imageUrl); } catch { /* reprise durable */ } } throw error; }
    }, "Enregistrement de l’image impossible. Réessayez.");
  };

  return <section className="admin-editor" aria-labelledby="quiz-editor-title"><h2 id="quiz-editor-title">Quiz</h2><p>Préparez les six thèmes et leurs questions.</p>
    <div className="admin-card-grid">{categories.map((category, index) => {
      const categoryQuestions = questions.filter((question) => question.categoryId === category.id).sort((a, b) => a.displayOrder - b.displayOrder);
      return <fieldset className="admin-content-card" aria-label={`Thème ${index + 1}`} key={category.id}><legend>Thème {index + 1}</legend>
        {category.imageUrl ? <img src={category.imageUrl} alt={`Aperçu de ${category.title}`} /> : null}
        <form className="admin-form admin-form--compact" onSubmit={(event) => { event.preventDefault(); void run(() => props.onSaveCategory(category)); }}>
          <label>Titre du thème<input value={category.title} onChange={(event) => changeCategory(category.id, { title: event.target.value })} /></label>
          <label>Illustration<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadCategory(event, category)} /></label>
          <button type="submit" disabled={pending || !category.title.trim()}>Enregistrer le thème</button>
        </form>
        <div className="admin-order-controls"><button type="button" disabled={pending || index === 0} onClick={() => void moveCategory(index, -1)}>Monter le thème</button><button type="button" disabled={pending || index === 5} onClick={() => void moveCategory(index, 1)}>Descendre le thème</button></div>
        <div className="admin-question-list">{categoryQuestions.map((question, questionIndex) => <QuestionForm key={question.id} question={question} pending={pending}
          onChange={(next) => setQuestions((current) => current.map((item) => item.id === next.id ? next : item))}
          onSave={(next) => run(() => props.onUpdateQuestion(next))}
          onDelete={() => run(() => props.onDeleteQuestion(question.id))}
          onMove={(direction) => {
            const target = questionIndex + direction; if (target < 0 || target >= categoryQuestions.length) return;
            const reordered = [...categoryQuestions]; [reordered[questionIndex], reordered[target]] = [reordered[target], reordered[questionIndex]];
            void run(() => props.onReorderQuestions(category.id, reordered.map((item) => item.id)));
          }} />)}</div>
        <NewQuestionForm categoryId={category.id} displayOrder={categoryQuestions.length} pending={pending} onCreate={(input) => run(() => props.onCreateQuestion(input))} />
      </fieldset>;
    })}</div>{error ? <p className="admin-alert" role="alert">{error}</p> : null}</section>;
}

function QuestionForm({ question, pending, onChange, onSave, onDelete, onMove }: {
  question: AdminQuizQuestion; pending: boolean; onChange(value: AdminQuizQuestion): void;
  onSave(value: AdminQuizQuestion): Promise<boolean>; onDelete(): Promise<boolean>; onMove(direction: -1 | 1): void;
}) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (Number.isInteger(question.points) && question.points > 0) void onSave(question); };
  return <form className="admin-form admin-question" aria-label={question.prompt} onSubmit={submit}>
    <label>Question<textarea value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} /></label>
    <label>Réponse<textarea value={question.answer} onChange={(event) => onChange({ ...question, answer: event.target.value })} /></label>
    <label>Points<input type="number" min="1" step="1" value={question.points} onChange={(event) => onChange({ ...question, points: Number(event.target.value) })} /></label>
    {(!Number.isInteger(question.points) || question.points <= 0) ? <p className="admin-alert" role="alert">Le nombre de points doit être un entier strictement positif.</p> : null}
    <button type="submit" disabled={pending}>Enregistrer la question</button><button type="button" disabled={pending} onClick={() => void onDelete()}>Supprimer la question</button>
    <div className="admin-order-controls"><button type="button" disabled={pending} onClick={() => onMove(-1)}>Monter la question</button><button type="button" disabled={pending} onClick={() => onMove(1)}>Descendre la question</button></div>
  </form>;
}

function NewQuestionForm({ categoryId, displayOrder, pending, onCreate }: { categoryId: string; displayOrder: number; pending: boolean; onCreate(input: CreateQuizQuestionInput): Promise<boolean> }) {
  const [prompt, setPrompt] = useState(""); const [answer, setAnswer] = useState(""); const [points, setPoints] = useState(10);
  return <form className="admin-form admin-question admin-question--new" aria-label="Ajouter une question" onSubmit={(event) => { event.preventDefault(); if (prompt.trim() && answer.trim() && Number.isInteger(points) && points > 0) void onCreate({ categoryId, prompt: prompt.trim(), answer: answer.trim(), points, displayOrder }); }}>
    <h4>Ajouter une question</h4><label>Nouvelle question<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label><label>Nouvelle réponse<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} /></label><label>Points de la nouvelle question<input type="number" min="1" step="1" value={points} onChange={(event) => setPoints(Number(event.target.value))} /></label><button type="submit" disabled={pending || !prompt.trim() || !answer.trim() || points <= 0}>Ajouter</button>
  </form>;
}
