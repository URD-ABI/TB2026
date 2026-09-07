import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SupabaseEventRepository,
  mapCategoryRow,
  mapChallengeRow,
  mapEventRow,
  mapParticipantRow,
  mapQuestionRow,
  mapTeamRow,
} from "./SupabaseEventRepository";

type QueryResult = { data: unknown; error: { message: string } | null };
type QueryCall = {
  table: string;
  operation: "select" | "update";
  filters: Array<["eq" | "in", string, unknown]>;
  payload?: unknown;
};

const eventRow = {
  id: "event-1", slug: "tournoi-des-arcanes", title: "Le Tournoi des Arcanes",
  subtitle: "Team Building 2026", background_path: "event-1/background.webp", quiz_enabled: true,
};
const teamRow = {
  id: "team-1", event_id: "event-1", name: "Hiboux", color: "#112233", emblem: "✦",
  display_order: 2, points: 120, keys: 3, tie_break_priority: 1,
};
const participantRow = {
  id: "participant-1", event_id: "event-1", name: "Alex", photo_path: "event-1/alex.webp",
  revealed_team_id: "team-1", reveal_order: 4, revealed_at: "2026-12-18T10:00:00Z",
};
const challengeRow = {
  id: "challenge-1", event_id: "event-1", title: "Énigme", kind: "Adresse",
  description: "Trouver la clé", image_path: "event-1/challenge.webp", display_order: 3,
};
const categoryRow = {
  id: "category-1", event_id: "event-1", title: "Sortilèges",
  image_path: "event-1/category.webp", display_order: 1, status: "available",
};
const questionRow = {
  id: "question-1", category_id: "category-1", prompt: "Question ?", points: 20, display_order: 0,
};

function makeQueryClient(results: Record<string, QueryResult>) {
  const calls: QueryCall[] = [];
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://project-ref.supabase.co/storage/v1/object/public/event-media/${path}` },
  }));
  const from = vi.fn((table: string) => {
    const call: QueryCall = { table, operation: "select", filters: [] };
    calls.push(call);
    const builder = {
      select: vi.fn(() => builder),
      update: vi.fn((payload: unknown) => { call.operation = "update"; call.payload = payload; return builder; }),
      eq: vi.fn((column: string, value: unknown) => { call.filters.push(["eq", column, value]); return builder; }),
      in: vi.fn((column: string, value: unknown) => { call.filters.push(["in", column, value]); return builder; }),
      single: vi.fn(() => builder),
      then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(results[table] ?? { data: [], error: null }).then(resolve, reject),
    };
    return builder;
  });
  const storage = { from: vi.fn(() => ({ getPublicUrl })) };
  return { client: { from, storage }, calls, getPublicUrl };
}

function makeSnapshotClient(overrides: Record<string, QueryResult> = {}) {
  return makeQueryClient({
    events: { data: eventRow, error: null },
    teams: { data: [teamRow], error: null },
    participants: { data: [participantRow], error: null },
    challenges: { data: [challengeRow], error: null },
    quiz_categories: { data: [categoryRow], error: null },
    quiz_questions: { data: [questionRow], error: null },
    ...overrides,
  });
}

describe("mappers Supabase", () => {
  it("convertit les champs snake_case d'un événement", () => {
    expect(mapEventRow(eventRow)).toEqual({
      id: "event-1", slug: "tournoi-des-arcanes", title: "Le Tournoi des Arcanes",
      subtitle: "Team Building 2026", backgroundUrl: "event-1/background.webp", quizEnabled: true,
    });
  });

  it("convertit les champs snake_case d'une équipe", () => {
    expect(mapTeamRow(teamRow)).toEqual({
      id: "team-1", eventId: "event-1", name: "Hiboux", color: "#112233", emblem: "✦",
      displayOrder: 2, points: 120, keys: 3, tieBreakPriority: 1,
    });
  });

  it("convertit les champs snake_case d'un participant", () => {
    expect(mapParticipantRow(participantRow)).toEqual({
      id: "participant-1", eventId: "event-1", name: "Alex", photoUrl: "event-1/alex.webp",
      revealedTeamId: "team-1", revealOrder: 4, revealedAt: "2026-12-18T10:00:00Z",
    });
  });

  it("convertit les champs snake_case d'un défi", () => {
    expect(mapChallengeRow(challengeRow)).toEqual({
      id: "challenge-1", eventId: "event-1", title: "Énigme", kind: "Adresse",
      description: "Trouver la clé", imageUrl: "event-1/challenge.webp", displayOrder: 3,
    });
  });

  it("convertit les champs snake_case d'un thème", () => {
    expect(mapCategoryRow(categoryRow)).toEqual({
      id: "category-1", eventId: "event-1", title: "Sortilèges",
      imageUrl: "event-1/category.webp", displayOrder: 1, status: "available",
    });
  });

  it("convertit les champs snake_case d'une question", () => {
    expect(mapQuestionRow(questionRow)).toEqual({
      id: "question-1", categoryId: "category-1", prompt: "Question ?", points: 20, displayOrder: 0,
    });
  });
});

describe("SupabaseEventRepository", () => {
  afterEach(() => vi.useRealTimers());

  it("charge l'événement puis un instantané public cohérent", async () => {
    const { client, calls } = makeSnapshotClient();
    const repository = new SupabaseEventRepository(client as never);

    await expect(repository.getSnapshot("tournoi-des-arcanes")).resolves.toEqual({
      event: {
        ...mapEventRow(eventRow),
        backgroundUrl: "https://project-ref.supabase.co/storage/v1/object/public/event-media/event-1/background.webp",
      },
      teams: [mapTeamRow(teamRow)],
      participants: [{
        ...mapParticipantRow(participantRow),
        photoUrl: "https://project-ref.supabase.co/storage/v1/object/public/event-media/event-1/alex.webp",
      }],
      challenges: [{
        ...mapChallengeRow(challengeRow),
        imageUrl: "https://project-ref.supabase.co/storage/v1/object/public/event-media/event-1/challenge.webp",
      }],
      categories: [{
        ...mapCategoryRow(categoryRow),
        imageUrl: "https://project-ref.supabase.co/storage/v1/object/public/event-media/event-1/category.webp",
      }],
      questions: [mapQuestionRow(questionRow)],
    });
    expect(calls[0]).toMatchObject({ table: "events", filters: [["eq", "slug", "tournoi-des-arcanes"]] });
    for (const table of ["teams", "participants", "challenges", "quiz_categories"]) {
      expect(calls).toContainEqual(expect.objectContaining({ table, filters: [["eq", "event_id", "event-1"]] }));
    }
  });

  it("résout chaque chemin média public depuis le bucket event-media", async () => {
    const { client, getPublicUrl } = makeSnapshotClient();
    const repository = new SupabaseEventRepository(client as never);

    const snapshot = await repository.getSnapshot("tournoi-des-arcanes");

    expect(client.storage.from).toHaveBeenCalledWith("event-media");
    expect(getPublicUrl.mock.calls.map(([path]) => path)).toEqual(expect.arrayContaining([
      "event-1/background.webp",
      "event-1/alex.webp",
      "event-1/challenge.webp",
      "event-1/category.webp",
    ]));
    expect(snapshot.event.backgroundUrl).toMatch(/^https:\/\//);
    expect(snapshot.participants[0].photoUrl).toMatch(/^https:\/\//);
    expect(snapshot.challenges[0].imageUrl).toMatch(/^https:\/\//);
    expect(snapshot.categories[0].imageUrl).toMatch(/^https:\/\//);
  });

  it("reconvertit l'URL publique du fond en chemin avant la mise à jour", async () => {
    const { client, calls } = makeSnapshotClient({ events: { data: null, error: null } });
    const repository = new SupabaseEventRepository(client as never);
    const publicUrl = "https://project-ref.supabase.co/storage/v1/object/public/event-media/event-1/background.webp";

    await repository.updateEvent({
      ...mapEventRow(eventRow),
      backgroundUrl: publicUrl,
    });

    const update = calls.find((call) => call.table === "events" && call.operation === "update");
    expect(update?.payload).toMatchObject({ background_path: "event-1/background.webp" });
    expect(JSON.stringify(update?.payload)).not.toContain(publicUrl);
  });

  it("charge les questions uniquement depuis les catégories de l'événement", async () => {
    const secondCategory = { ...categoryRow, id: "category-2", display_order: 2 };
    const { client, calls } = makeSnapshotClient({
      quiz_categories: { data: [categoryRow, secondCategory], error: null },
    });
    const repository = new SupabaseEventRepository(client as never);

    await repository.getSnapshot("tournoi-des-arcanes");

    expect(calls).toContainEqual(expect.objectContaining({
      table: "quiz_questions",
      filters: [["in", "category_id", ["category-1", "category-2"]]],
    }));
  });

  it("ne publie pas d'instantané partiel lorsqu'une collection échoue", async () => {
    const { client } = makeSnapshotClient({ teams: { data: null, error: { message: "offline" } } });
    const repository = new SupabaseEventRepository(client as never);
    await expect(repository.getSnapshot("tournoi-des-arcanes")).rejects.toThrow(/offline/);
  });

  it("lance en parallèle les collections directement liées à l'événement", async () => {
    const started: string[] = [];
    const pending = new Map<string, { resolve: (result: QueryResult) => void; promise: Promise<QueryResult> }>();
    for (const table of ["teams", "participants", "challenges", "quiz_categories"]) {
      let resolve!: (result: QueryResult) => void;
      const promise = new Promise<QueryResult>((done) => { resolve = done; });
      pending.set(table, { resolve, promise });
    }
    const client = {
      from: (table: string) => {
        const builder = {
          select: () => builder, eq: () => builder, in: () => builder, single: () => builder,
          then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) => {
            started.push(table);
            const response = table === "events"
              ? Promise.resolve({ data: eventRow, error: null })
              : pending.get(table)?.promise ?? Promise.resolve({ data: [questionRow], error: null });
            return response.then(resolve, reject);
          },
        };
        return builder;
      },
    };
    const repository = new SupabaseEventRepository(client as never);

    const snapshotPromise = repository.getSnapshot("tournoi-des-arcanes");
    await vi.waitFor(() => {
      expect(started).toEqual(expect.arrayContaining([
        "teams",
        "participants",
        "challenges",
        "quiz_categories",
      ]));
    });
    pending.get("teams")?.resolve({ data: [teamRow], error: null });
    pending.get("participants")?.resolve({ data: [participantRow], error: null });
    pending.get("challenges")?.resolve({ data: [challengeRow], error: null });
    pending.get("quiz_categories")?.resolve({ data: [categoryRow], error: null });
    await expect(snapshotPromise).resolves.toMatchObject({ event: { id: "event-1" } });
  });

  it("appelle les RPC avec leurs paramètres PostgreSQL nommés", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ participant_id: "participant-1", team_id: "team-1" }], error: null });
    const repository = new SupabaseEventRepository({ rpc } as never);

    await expect(repository.revealParticipant("event-1", "participant-1")).resolves.toEqual({
      participantId: "participant-1", teamId: "team-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "reveal_next_participant", {
      p_event_id: "event-1", p_participant_id: "participant-1",
    });

    rpc.mockResolvedValueOnce({ data: "score-event-1", error: null });
    await repository.applyScore({
      eventId: "event-1", teamId: "team-1", points: 25, keys: 1,
      source: "quiz", idempotencyKey: "request-1",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "apply_score_event", {
      p_event_id: "event-1", p_team_id: "team-1", p_points: 25, p_keys: 1,
      p_source: "quiz", p_idempotency_key: "request-1",
    });
  });

  it("regroupe les changements rapides, signale la reconnexion puis se désabonne", async () => {
    vi.useFakeTimers();
    const query = makeSnapshotClient();
    const handlers: Array<() => void> = [];
    let statusHandler: ((status: string) => void) | undefined;
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => { handlers.push(handler); return channel; }),
      subscribe: vi.fn((handler: (status: string) => void) => { statusHandler = handler; return channel; }),
    };
    const removeChannel = vi.fn().mockResolvedValue(undefined);
    const client = { ...query.client, channel: vi.fn(() => channel), removeChannel };
    const repository = new SupabaseEventRepository(client as never);
    const snapshots: unknown[] = [];
    const statuses: string[] = [];

    const unsubscribe = repository.subscribe(
      "tournoi-des-arcanes",
      (snapshot) => snapshots.push(snapshot),
      (status) => statuses.push(status),
    );
    await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(snapshots).toHaveLength(1));
    expect(channel.on).toHaveBeenCalledTimes(7);
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "events", filter: "id=eq.event-1" },
      expect.any(Function),
    );
    for (const table of ["teams", "participants", "challenges", "quiz_categories", "quiz_sessions"]) {
      expect(channel.on).toHaveBeenCalledWith(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: "event_id=eq.event-1" },
        expect.any(Function),
      );
    }
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "quiz_questions" },
      expect.any(Function),
    );
    statusHandler?.("SUBSCRIBED");
    statusHandler?.("CHANNEL_ERROR");
    expect(statuses).toEqual(["online", "reconnecting"]);

    handlers[0]();
    handlers[1]();
    await vi.advanceTimersByTimeAsync(49);
    expect(snapshots).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(snapshots).toHaveLength(2));

    unsubscribe();
    expect(removeChannel).toHaveBeenCalledWith(channel);
    handlers[0]();
    await vi.advanceTimersByTimeAsync(50);
    expect(snapshots).toHaveLength(2);
  });

  it("retente le bootstrap après un échec et installe finalement le canal", async () => {
    vi.useFakeTimers();
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repository = new SupabaseEventRepository(client as never);
    const getSnapshot = vi.spyOn(repository, "getSnapshot")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(makeExpectedSnapshot("Après reprise"));
    const statuses: string[] = [];

    repository.subscribe("tournoi-des-arcanes", vi.fn(), (status) => statuses.push(status));
    await vi.waitFor(() => expect(statuses).toContain("reconnecting"));
    expect(client.channel).not.toHaveBeenCalled();

    await vi.runOnlyPendingTimersAsync();
    await vi.waitFor(() => expect(client.channel).toHaveBeenCalledOnce());
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(channel.subscribe).toHaveBeenCalledOnce();
  });

  it("retente un reload temps réel échoué puis publie le snapshot sans nouvelle mutation", async () => {
    vi.useFakeTimers();
    const handlers: Array<() => void> = [];
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => { handlers.push(handler); return channel; }),
      subscribe: vi.fn(() => channel),
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repository = new SupabaseEventRepository(client as never);
    const getSnapshot = vi.spyOn(repository, "getSnapshot")
      .mockResolvedValueOnce(makeExpectedSnapshot("Initial"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(makeExpectedSnapshot("Après reprise"));
    const received: string[] = [];
    const statuses: string[] = [];

    const unsubscribe = repository.subscribe(
      "tournoi-des-arcanes",
      (snapshot) => received.push(snapshot.teams[0].name),
      (status) => statuses.push(status),
    );
    await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalledOnce());
    expect(received).toEqual(["Initial"]);

    handlers[0]();
    await vi.advanceTimersByTimeAsync(50);
    await vi.waitFor(() => expect(statuses).toContain("reconnecting"));
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(received).toEqual(["Initial"]);

    await vi.runOnlyPendingTimersAsync();
    await vi.waitFor(() => expect(received).toEqual(["Initial", "Après reprise"]));
    expect(getSnapshot).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it("annule le retry d'un reload temps réel lors de la désinscription", async () => {
    vi.useFakeTimers();
    const handlers: Array<() => void> = [];
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => { handlers.push(handler); return channel; }),
      subscribe: vi.fn(() => channel),
    };
    const removeChannel = vi.fn();
    const client = { channel: vi.fn(() => channel), removeChannel };
    const repository = new SupabaseEventRepository(client as never);
    const getSnapshot = vi.spyOn(repository, "getSnapshot")
      .mockResolvedValueOnce(makeExpectedSnapshot("Initial"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(makeExpectedSnapshot("Ne doit pas être publié"));
    const received: string[] = [];
    const statuses: string[] = [];

    const unsubscribe = repository.subscribe(
      "tournoi-des-arcanes",
      (snapshot) => received.push(snapshot.teams[0].name),
      (status) => statuses.push(status),
    );
    await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalledOnce());
    handlers[0]();
    await vi.advanceTimersByTimeAsync(50);
    await vi.waitFor(() => expect(statuses).toContain("reconnecting"));

    unsubscribe();
    await vi.runAllTimersAsync();

    expect(removeChannel).toHaveBeenCalledWith(channel);
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(received).toEqual(["Initial"]);
  });

  it("recharge après la confirmation SUBSCRIBED pour fermer la fenêtre d'abonnement", async () => {
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn() };
    let statusHandler: ((status: string) => void) | undefined;
    channel.subscribe.mockImplementation((handler: (status: string) => void) => {
      statusHandler = handler;
      return channel;
    });
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repository = new SupabaseEventRepository(client as never);
    vi.spyOn(repository, "getSnapshot")
      .mockResolvedValueOnce(makeExpectedSnapshot("Avant abonnement"))
      .mockResolvedValueOnce(makeExpectedSnapshot("Après abonnement"));
    const received: string[] = [];

    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot.teams[0].name));
    await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalledOnce());
    statusHandler?.("SUBSCRIBED");

    await vi.waitFor(() => expect(received).toEqual(["Avant abonnement", "Après abonnement"]));
  });

  it("empêche un ancien reload concurrent d'écraser le snapshot le plus récent", async () => {
    vi.useFakeTimers();
    const handlers: Array<() => void> = [];
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => { handlers.push(handler); return channel; }),
      subscribe: vi.fn(() => channel),
    };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn() };
    const repository = new SupabaseEventRepository(client as never);
    const older = deferredSnapshot();
    const newer = deferredSnapshot();
    vi.spyOn(repository, "getSnapshot")
      .mockResolvedValueOnce(makeExpectedSnapshot("Initial"))
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    const received: string[] = [];

    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot.teams[0].name));
    await vi.waitFor(() => expect(channel.subscribe).toHaveBeenCalledOnce());
    handlers[0]();
    await vi.advanceTimersByTimeAsync(50);
    handlers[1]();
    await vi.advanceTimersByTimeAsync(50);

    newer.resolve(makeExpectedSnapshot("Nouveau"));
    await vi.waitFor(() => expect(received.at(-1)).toBe("Nouveau"));
    older.resolve(makeExpectedSnapshot("Ancien"));
    await Promise.resolve();
    await Promise.resolve();
    expect(received.at(-1)).toBe("Nouveau");
  });
});

function makeExpectedSnapshot(teamName: string) {
  return {
    event: mapEventRow(eventRow),
    teams: [{ ...mapTeamRow(teamRow), name: teamName }],
    participants: [mapParticipantRow(participantRow)],
    challenges: [mapChallengeRow(challengeRow)],
    categories: [mapCategoryRow(categoryRow)],
    questions: [mapQuestionRow(questionRow)],
  };
}

function deferredSnapshot() {
  let resolve!: (snapshot: ReturnType<typeof makeExpectedSnapshot>) => void;
  const promise = new Promise<ReturnType<typeof makeExpectedSnapshot>>((done) => { resolve = done; });
  return { promise, resolve };
}
