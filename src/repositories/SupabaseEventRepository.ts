import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Challenge,
  EventConfig,
  Participant,
  QuizCategory,
  QuizQuestion,
  Team,
} from "../domain/types";
import type {
  ConnectionStatus,
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

    const [teamsResult, participantsResult, challengesResult, categoriesResult] = await Promise.all([
      this.client.from("teams").select("*").eq("event_id", event.id),
      this.client.from("participants").select("*").eq("event_id", event.id),
      this.client.from("challenges").select("*").eq("event_id", event.id),
      this.client.from("quiz_categories").select("*").eq("event_id", event.id),
    ]) as [QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>];

    const teams = ordered(unwrap(teamsResult).map(mapTeamRow));
    const participants = [...unwrap(participantsResult).map(mapParticipantRow)]
      .sort((left, right) => left.revealOrder - right.revealOrder);
    const challenges = ordered(unwrap(challengesResult).map(mapChallengeRow));
    const categories = ordered(unwrap(categoriesResult).map(mapCategoryRow));
    const categoryIds = categories.map((category) => category.id);
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
    const result = await this.client.from("events").update({
      slug: event.slug,
      title: event.title,
      subtitle: event.subtitle,
      background_path: storagePath(event.backgroundUrl),
      quiz_enabled: event.quizEnabled,
    }).eq("id", event.id) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
  }

  async updateTeam(team: Team): Promise<void> {
    const result = await this.client.from("teams").update({
      name: team.name,
      color: team.color,
      emblem: team.emblem,
      display_order: team.displayOrder,
      points: team.points,
      keys: team.keys,
      tie_break_priority: team.tieBreakPriority,
    }).eq("id", team.id).eq("event_id", team.eventId) as QueryResult<unknown>;
    if (result.error) throw new Error(result.error.message);
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
}
