import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminParticipant,
  AdminQuizQuestion,
  Challenge,
  EventConfig,
  Participant,
  QuizCategory,
  QuizQuestion,
  QuizSession,
  ScoreEvent,
  Team,
} from "../domain/types";
import { resizeImage } from "../lib/images";
import type {
  ConnectionStatus,
  CreateParticipantInput,
  CreateQuizQuestionInput,
  EventRepository,
  EventSnapshot,
  Unsubscribe,
} from "./EventRepository";

type Row = Record<string, unknown>;
type QueryResult<T> = { data: T | null; error: { message: string } | null };

const MEDIA_BUCKET = "event-media";
const BOOTSTRAP_RETRY_DELAY_MS = 1_000;

function stringValue(row: Row, field: string): string {
  return row[field] as string;
}

function nullableString(row: Row, field: string): string | null {
  return (row[field] as string | null | undefined) ?? null;
}

export function mapEventRow(row: Row): EventConfig {
  return {
    id: stringValue(row, "id"),
    slug: stringValue(row, "slug"),
    title: stringValue(row, "title"),
    subtitle: stringValue(row, "subtitle"),
    backgroundUrl: nullableString(row, "background_path"),
    quizEnabled: row.quiz_enabled as boolean,
    scoreCapacity: row.score_capacity as number,
  };
}

export function mapTeamRow(row: Row): Team {
  return {
    id: stringValue(row, "id"),
    eventId: stringValue(row, "event_id"),
    name: stringValue(row, "name"),
    color: stringValue(row, "color"),
    emblem: nullableString(row, "emblem") ?? "",
    displayOrder: row.display_order as number,
    points: row.points as number,
    keys: row.keys as number,
    tieBreakPriority: (row.tie_break_priority as number | null | undefined) ?? null,
  };
}

export function mapParticipantRow(row: Row): Participant {
  return {
    id: stringValue(row, "id"),
    eventId: stringValue(row, "event_id"),
    name: stringValue(row, "name"),
    photoUrl: nullableString(row, "photo_path"),
    revealedTeamId: nullableString(row, "revealed_team_id"),
    revealOrder: row.reveal_order as number,
    revealedAt: nullableString(row, "revealed_at"),
  };
}

export function mapChallengeRow(row: Row): Challenge {
  return {
    id: stringValue(row, "id"),
    eventId: stringValue(row, "event_id"),
    title: stringValue(row, "title"),
    kind: stringValue(row, "kind"),
    description: stringValue(row, "description"),
    imageUrl: nullableString(row, "image_path"),
    displayOrder: row.display_order as number,
  };
}

export function mapCategoryRow(row: Row): QuizCategory {
  return {
    id: stringValue(row, "id"),
    eventId: stringValue(row, "event_id"),
    title: stringValue(row, "title"),
    imageUrl: nullableString(row, "image_path"),
    displayOrder: row.display_order as number,
    status: row.status as QuizCategory["status"],
    chosenByTeamId: nullableString(row, "chosen_by_team_id"),
  };
}

export function mapQuizSessionRow(row: Row): QuizSession {
  return {
    id: stringValue(row, "id"),
    eventId: stringValue(row, "event_id"),
    teamOrder: row.team_order as string[],
    currentTeamIndex: row.current_team_index as number,
    activeCategoryId: nullableString(row, "active_category_id"),
    activeQuestionIndex: row.active_question_index as number,
    answerVisible: row.answer_visible as boolean,
    revealedAnswer: nullableString(row, "revealed_answer"),
    startedAt: nullableString(row, "started_at"),
  };
}

export function mapQuestionRow(row: Row): QuizQuestion {
  return {
    id: stringValue(row, "id"),
    categoryId: stringValue(row, "category_id"),
    prompt: stringValue(row, "prompt"),
    points: row.points as number,
    displayOrder: row.display_order as number,
  };
}

function mapAdminQuestionRow(row: Row): AdminQuizQuestion {
  return { ...mapQuestionRow(row), answer: stringValue(row, "answer") };
}

function mapScoreEventRow(row: Row): ScoreEvent {
  return {
    id: stringValue(row, "id"), eventId: stringValue(row, "event_id"), teamId: stringValue(row, "team_id"),
    pointsDelta: row.points_delta as number, keysDelta: row.keys_delta as number, source: stringValue(row, "source"),
    createdAt: stringValue(row, "created_at"), reversedAt: nullableString(row, "reversed_at"),
  };
}

function unwrap<T>(result: QueryResult<T>): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("supabase_empty_response");
  return result.data;
}

function ordered<T extends { displayOrder: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.displayOrder - right.displayOrder);
}

function storagePath(value: string | null): string | null {
  if (value === null) return null;

  try {
    const url = new URL(value);
    const marker = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
    if (!url.pathname.startsWith(marker)) throw new Error("invalid_event_media_url");
    const path = decodeURIComponent(url.pathname.slice(marker.length));
    if (!path || path.split("/").some((part) => part === "." || part === "..")) {
      throw new Error("invalid_event_media_path");
    }
    return path;
  } catch (error) {
    if (error instanceof TypeError) return value;
    throw error;
  }
}

export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly client: SupabaseClient) {}

  private publicMediaUrl(path: string | null): string | null {
    if (path === null || !this.client.storage) return path;
    return this.client.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async getSnapshot(slug: string): Promise<EventSnapshot> {
    const eventResult = await this.client
      .from("events")
      .select("*")
      .eq("slug", slug)
      .single() as QueryResult<Row>;
    const event = mapEventRow(unwrap(eventResult));

    const [teamsResult, participantsResult, challengesResult, categoriesResult, sessionsResult] = await Promise.all([
      this.client.from("teams").select("*").eq("event_id", event.id),
      this.client.from("participants").select("*").eq("event_id", event.id),
      this.client.from("challenges").select("*").eq("event_id", event.id),
      this.client.from("quiz_categories").select("*").eq("event_id", event.id),
      this.client.from("quiz_sessions").select("*").eq("event_id", event.id),
    ]) as [QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[] | Row>];

    const teams = ordered(unwrap(teamsResult).map(mapTeamRow));
    const participants = [...unwrap(participantsResult).map(mapParticipantRow)]
      .sort((left, right) => left.revealOrder - right.revealOrder);
    const challenges = ordered(unwrap(challengesResult).map(mapChallengeRow));
    const categories = ordered(unwrap(categoriesResult).map(mapCategoryRow));
    const categoryIds = categories.map((category) => category.id);
    const sessionRows = unwrap(sessionsResult);
    const sessionRow = Array.isArray(sessionRows) ? sessionRows[0] : sessionRows;
    const quizSession = sessionRow ? mapQuizSessionRow(sessionRow) : null;
    let questions: QuizQuestion[] = [];
    if (categoryIds.length > 0) {
      const questionsResult = await this.client
        .from("quiz_questions")
        .select("*")
        .in("category_id", categoryIds) as QueryResult<Row[]>;
      questions = ordered(unwrap(questionsResult).map(mapQuestionRow));
    }

    return {
      event: { ...event, backgroundUrl: this.publicMediaUrl(event.backgroundUrl) },
      teams,
      participants: participants.map((participant) => ({
        ...participant,
        photoUrl: this.publicMediaUrl(participant.photoUrl),
      })),
      challenges: challenges.map((challenge) => ({
        ...challenge,
        imageUrl: this.publicMediaUrl(challenge.imageUrl),
      })),
      categories: categories.map((category) => ({
        ...category,
        imageUrl: this.publicMediaUrl(category.imageUrl),
      })),
      questions,
      quizSession,
    };
  }

  subscribe(
    slug: string,
    listener: (snapshot: EventSnapshot) => void,
    connectionListener: (status: ConnectionStatus) => void = () => undefined,
  ): Unsubscribe {
    let disposed = false;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    let bootstrapRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let reloadRetryTimer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<SupabaseClient["channel"]> | undefined;
    let reloadVersion = 0;

    const reload = async (): Promise<EventSnapshot | undefined> => {
      const version = ++reloadVersion;
      try {
        const snapshot = await this.getSnapshot(slug);
        if (!disposed && version === reloadVersion) listener(snapshot);
        return snapshot;
      } catch {
        if (!disposed && version === reloadVersion) connectionListener("reconnecting");
        return undefined;
      }
    };

    const scheduleReloadRetry = (): void => {
      if (disposed || reloadRetryTimer !== undefined) return;
      reloadRetryTimer = setTimeout(async () => {
        reloadRetryTimer = undefined;
        const snapshot = await reload();
        if (!snapshot) {
          scheduleReloadRetry();
        } else if (!disposed) {
          connectionListener("online");
        }
      }, BOOTSTRAP_RETRY_DELAY_MS);
    };

    const scheduleReload = (): void => {
      if (disposed) return;
      if (reloadTimer !== undefined) clearTimeout(reloadTimer);
      if (reloadRetryTimer !== undefined) {
        clearTimeout(reloadRetryTimer);
        reloadRetryTimer = undefined;
      }
      reloadTimer = setTimeout(() => {
        reloadTimer = undefined;
        void reload().then((snapshot) => {
          if (!snapshot) scheduleReloadRetry();
        });
      }, 50);
    };

    const bootstrap = async (): Promise<void> => {
      const initialSnapshot = await reload();
      if (disposed) return;
      if (!initialSnapshot) {
        bootstrapRetryTimer = setTimeout(() => {
          bootstrapRetryTimer = undefined;
          void bootstrap();
        }, BOOTSTRAP_RETRY_DELAY_MS);
        return;
      }
      const eventId = initialSnapshot.event.id;
      channel = this.client.channel(`event:${eventId}`);
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}` },
        scheduleReload,
      );
      for (const table of ["teams", "participants", "challenges", "quiz_categories", "quiz_sessions"]) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `event_id=eq.${eventId}` },
          scheduleReload,
        );
      }
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_questions" },
        scheduleReload,
      );
      channel.subscribe((status) => {
        if (disposed) return;
        connectionListener(status === "SUBSCRIBED" ? "online" : "reconnecting");
        if (status === "SUBSCRIBED") scheduleReload();
      });
    };

    void bootstrap();

    return () => {
      disposed = true;
      if (reloadTimer !== undefined) clearTimeout(reloadTimer);
      if (bootstrapRetryTimer !== undefined) clearTimeout(bootstrapRetryTimer);
      if (reloadRetryTimer !== undefined) clearTimeout(reloadRetryTimer);
      if (channel) void this.client.removeChannel(channel);
    };
  }

  async updateEvent(event: EventConfig): Promise<void> {
    const result = await this.client.rpc("update_event", {
      p_event_id: event.id,
      p_slug: event.slug,
      p_title: event.title,
      p_subtitle: event.subtitle,
      p_background_path: storagePath(event.backgroundUrl),
      p_quiz_enabled: event.quizEnabled,
      p_score_capacity: event.scoreCapacity,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async updateTeam(team: Team): Promise<void> {
    const result = await this.client.from("teams").update({
      name: team.name,
      color: team.color,
      emblem: team.emblem,
      display_order: team.displayOrder,
    }).eq("id", team.id).eq("event_id", team.eventId) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async getAdminParticipants(eventId: string): Promise<AdminParticipant[]> {
    const [participantsResult, assignmentsResult] = await Promise.all([
      this.client.from("participants").select("*").eq("event_id", eventId),
      this.client.from("participant_assignments").select("participant_id,team_id"),
    ]) as [QueryResult<Row[]>, QueryResult<Row[]>];
    const assignments = new Map(unwrap(assignmentsResult).map((row) => [
      stringValue(row, "participant_id"),
      stringValue(row, "team_id"),
    ]));
    return unwrap(participantsResult)
      .map(mapParticipantRow)
      .sort((left, right) => left.revealOrder - right.revealOrder)
      .map((participant) => ({
        ...participant,
        photoUrl: this.publicMediaUrl(participant.photoUrl),
        assignedTeamId: assignments.get(participant.id) ?? "",
      }));
  }

  async createParticipant(input: CreateParticipantInput): Promise<void> {
    const participantId = crypto.randomUUID();
    const result = await this.client.rpc("create_participant", {
      p_event_id: input.eventId,
      p_participant_id: participantId,
      p_name: input.name,
      p_photo_path: storagePath(input.photoUrl),
      p_team_id: input.assignedTeamId,
      p_reveal_order: input.revealOrder,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async updateParticipant(participant: AdminParticipant): Promise<void> {
    const result = await this.client.rpc("update_participant", {
      p_event_id: participant.eventId,
      p_participant_id: participant.id,
      p_name: participant.name,
      p_photo_path: storagePath(participant.photoUrl),
      p_team_id: participant.assignedTeamId,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async deleteParticipant(eventId: string, participantId: string): Promise<void> {
    const result = await this.client.rpc("delete_participant", {
      p_event_id: eventId,
      p_participant_id: participantId,
    }) as QueryResult<string>;
    if (result.error) throw new Error(result.error.message);
    await this.cleanupPendingMedia(eventId);
  }

  async reorderParticipants(eventId: string, orderedParticipantIds: string[]): Promise<void> {
    const result = await this.client.rpc("reorder_participants", {
      p_event_id: eventId,
      p_participant_ids: orderedParticipantIds,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async resetParticipantReveals(eventId: string): Promise<void> {
    const result = await this.client.rpc("reset_participant_reveals", { p_event_id: eventId }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async setTeamTieBreakOrder(eventId: string, orderedTeamIds: string[]): Promise<void> {
    const result = await this.client.rpc("set_team_tie_break_order", {
      p_event_id: eventId,
      p_team_ids: orderedTeamIds,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async updateChallenge(challenge: Challenge): Promise<void> {
    const result = await this.client.rpc("update_challenge", {
      p_event_id: challenge.eventId, p_challenge_id: challenge.id, p_title: challenge.title,
      p_kind: challenge.kind, p_description: challenge.description, p_image_path: storagePath(challenge.imageUrl),
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async reorderChallenges(eventId: string, orderedIds: string[]): Promise<void> {
    const result = await this.client.rpc("reorder_challenges", { p_event_id: eventId, p_challenge_ids: orderedIds }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async getAdminQuizQuestions(eventId: string): Promise<AdminQuizQuestion[]> {
    const result = await this.client.rpc("get_admin_quiz_questions", { p_event_id: eventId }) as QueryResult<Row[]>;
    return unwrap(result).map(mapAdminQuestionRow).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async updateQuizCategory(category: QuizCategory): Promise<void> {
    const result = await this.client.rpc("update_quiz_category", {
      p_event_id: category.eventId, p_category_id: category.id, p_title: category.title, p_image_path: storagePath(category.imageUrl),
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async reorderQuizCategories(eventId: string, orderedIds: string[]): Promise<void> {
    const result = await this.client.rpc("reorder_quiz_categories", { p_event_id: eventId, p_category_ids: orderedIds }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async createQuizQuestion(input: CreateQuizQuestionInput): Promise<void> {
    const result = await this.client.rpc("create_quiz_question", { p_question_id: crypto.randomUUID(), p_category_id: input.categoryId, p_prompt: input.prompt, p_answer: input.answer, p_points: input.points, p_display_order: input.displayOrder }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async updateQuizQuestion(question: AdminQuizQuestion): Promise<void> {
    const result = await this.client.rpc("update_quiz_question", { p_question_id: question.id, p_category_id: question.categoryId, p_prompt: question.prompt, p_answer: question.answer, p_points: question.points }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async deleteQuizQuestion(questionId: string): Promise<void> {
    const result = await this.client.rpc("delete_quiz_question", { p_question_id: questionId }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async reorderQuizQuestions(categoryId: string, orderedIds: string[]): Promise<void> {
    const result = await this.client.rpc("reorder_quiz_questions", { p_category_id: categoryId, p_question_ids: orderedIds }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async uploadEventBackground(file: File, eventId: string): Promise<string> {
    return this.uploadImage(file, eventId, `${eventId}/background-${crypto.randomUUID()}.webp`, 1920, 1080);
  }

  async uploadParticipantPhoto(file: File, eventId: string, participantId: string): Promise<string> {
    return this.uploadImage(file, eventId, `${eventId}/participants/${participantId}-${crypto.randomUUID()}.webp`, 1200, 1200);
  }

  async uploadChallengeImage(file: File, eventId: string, challengeId: string): Promise<string> {
    return this.uploadImage(file, eventId, `${eventId}/challenges/${challengeId}-${crypto.randomUUID()}.webp`, 1400, 900);
  }

  async uploadQuizCategoryImage(file: File, eventId: string, categoryId: string): Promise<string> {
    return this.uploadImage(file, eventId, `${eventId}/quiz/${categoryId}-${crypto.randomUUID()}.webp`, 1200, 800);
  }

  async cleanupPendingMedia(eventId: string): Promise<void> {
    const listed = await this.client.rpc("list_media_cleanup", { p_event_id: eventId }) as QueryResult<string[]>;
    const paths = unwrap(listed);
    if (paths.some((path) => !path.startsWith(`${eventId}/`) || path.split("/").some((part) => part === "." || part === ".."))) {
      throw new Error("invalid_event_media_path");
    }
    if (paths.length === 0) return;

    const removal = await this.client.storage.from(MEDIA_BUCKET).remove(paths);
    if (removal.error) throw new Error(removal.error.message);
    const acknowledged = await this.client.rpc("ack_media_cleanup", {
      p_event_id: eventId,
      p_paths: paths,
    }) as QueryResult<unknown>;
    if (acknowledged.error) throw new Error(acknowledged.error.message);
  }

  async removeMedia(url: string): Promise<void> {
    const path = storagePath(url);
    if (!path) return;
    const result = await this.client.storage.from(MEDIA_BUCKET).remove([path]);
    if (result.error) throw new Error(result.error.message);
    const eventId = path.split("/")[0];
    const acknowledged = await this.client.rpc("ack_media_cleanup", {
      p_event_id: eventId,
      p_paths: [path],
    }) as QueryResult<unknown>;
    if (acknowledged.error) throw new Error(acknowledged.error.message);
  }

  private async uploadImage(file: File, eventId: string, path: string, maximumWidth: number, maximumHeight: number): Promise<string> {
    const optimized = await resizeImage(file, maximumWidth, maximumHeight, 0.84);
    const bucket = this.client.storage.from(MEDIA_BUCKET);
    const result = await bucket.upload(path, optimized, { contentType: "image/webp", upsert: true });
    if (result.error) throw new Error(result.error.message);
    const queued = await this.client.rpc("queue_media_cleanup", { p_event_id: eventId, p_path: path }) as QueryResult<unknown>;
    if (queued.error) {
      await bucket.remove([path]);
      throw new Error(queued.error.message);
    }
    return bucket.getPublicUrl(path).data.publicUrl;
  }

  async revealParticipant(eventId: string, participantId: string): Promise<{ participantId: string; teamId: string }> {
    const result = await this.client.rpc("reveal_next_participant", {
      p_event_id: eventId,
      p_participant_id: participantId,
    }) as QueryResult<Array<{ participant_id: string; team_id: string }>>;
    const [revealed] = unwrap(result);
    if (!revealed) throw new Error("no_participant");
    return { participantId: revealed.participant_id, teamId: revealed.team_id };
  }

  async applyScore(input: Parameters<EventRepository["applyScore"]>[0]): Promise<void> {
    const result = await this.client.rpc("apply_score_event", {
      p_event_id: input.eventId,
      p_team_id: input.teamId,
      p_points: input.points,
      p_keys: input.keys,
      p_source: input.source,
      p_idempotency_key: input.idempotencyKey,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async chooseQuizCategory(input: Parameters<EventRepository["chooseQuizCategory"]>[0]): Promise<void> {
    const result = await this.client.rpc("choose_quiz_category", {
      p_session_id: input.sessionId,
      p_team_id: input.teamId,
      p_category_id: input.categoryId,
    }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async startQuiz(eventId: string): Promise<void> {
    const result = await this.client.rpc("start_quiz", { p_event_id: eventId }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async revealQuizAnswer(sessionId: string, questionId: string): Promise<void> {
    const result = await this.client.rpc("reveal_quiz_answer", { p_session_id: sessionId, p_question_id: questionId }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async answerQuizQuestion(sessionId: string, questionId: string, correct: boolean, idempotencyKey: string): Promise<void> {
    const result = await this.client.rpc("answer_quiz_question", { p_session_id: sessionId, p_question_id: questionId, p_correct: correct, p_idempotency_key: idempotencyKey }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async getScoreHistory(eventId: string): Promise<ScoreEvent[]> {
    const result = await this.client.rpc("get_score_history", { p_event_id: eventId }) as QueryResult<Row[]>;
    return unwrap(result).map(mapScoreEventRow);
  }

  async reverseScoreEvent(scoreEventId: string): Promise<void> {
    const result = await this.client.rpc("reverse_score_event", { p_score_event_id: scoreEventId }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async resetRehearsal(eventId: string): Promise<void> {
    const result = await this.client.rpc("reset_rehearsal", { p_event_id: eventId }) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }
}
