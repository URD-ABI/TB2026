import { describe, expect, it } from "vitest";
import { MemoryEventRepository } from "./MemoryEventRepository";
import { makeEventSnapshot, makeParticipant, makeTeam } from "../test/fixtures";

describe("MemoryEventRepository", () => {
  it("émet immédiatement une copie isolée à la souscription", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    const received: Awaited<ReturnType<typeof repository.getSnapshot>>[] = [];

    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot));
    expect(received).toHaveLength(1);
    received[0].teams[0].name = "mutated";

    const snapshot = await repository.getSnapshot("tournoi-des-arcanes");
    expect(snapshot.teams[0].name).toBe("Équipe A");
    expect(snapshot).not.toBe(received[0]);
  });

  it("émet immédiatement même si le slug demandé diffère", () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    const received: unknown[] = [];
    repository.subscribe("another-slug", (snapshot) => received.push(snapshot));
    expect(received).toHaveLength(1);
  });

  it("notifie les abonnés existants quand le slug de l’événement change", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    const received: string[] = [];
    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot.event.slug));
    await repository.updateEvent({ ...makeEventSnapshot().event, slug: "nouveau-slug" });
    expect(received).toEqual(["tournoi-des-arcanes", "nouveau-slug"]);
  });

  it("applique un score et efface le départage précédent", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot({
      teams: [makeTeam({ tieBreakPriority: 3, points: 10, keys: 1 })],
    }), {});
    const received: Awaited<ReturnType<typeof repository.getSnapshot>>[] = [];
    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot));

    await repository.applyScore({
      eventId: "event-1", teamId: "team-a", points: 7, keys: 2,
      source: "challenge", idempotencyKey: "score-1",
    });

    const team = (await repository.getSnapshot("tournoi-des-arcanes")).teams[0];
    expect(team).toMatchObject({ points: 17, keys: 3, tieBreakPriority: null });
    expect(received).toHaveLength(2);
  });

  it("rejette une équipe inconnue sans consommer la clé d’idempotence", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    const received: Awaited<ReturnType<typeof repository.getSnapshot>>[] = [];
    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot));
    const input = {
      eventId: "missing-event", teamId: "missing-team", points: 7, keys: 2,
      source: "challenge", idempotencyKey: "retryable-score",
    };

    await expect(repository.applyScore(input)).rejects.toThrow("team_not_found");
    expect(received).toHaveLength(1);

    await repository.applyScore({ ...input, eventId: "event-1", teamId: "team-a" });
    expect((await repository.getSnapshot("tournoi-des-arcanes")).teams[0]).toMatchObject({ points: 7, keys: 2 });
    expect(received).toHaveLength(2);
  });

  it("n’applique qu’une seule fois une clé d’idempotence répétée", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    const received: Awaited<ReturnType<typeof repository.getSnapshot>>[] = [];
    repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot));
    const input = { eventId: "event-1", teamId: "team-a", points: 5, keys: 1, source: "quiz", idempotencyKey: "once" };

    await repository.applyScore(input);
    await repository.applyScore(input);
    expect((await repository.getSnapshot("tournoi-des-arcanes")).teams[0]).toMatchObject({ points: 5, keys: 1 });
    expect(received).toHaveLength(2);
  });

  it("cesse de notifier un abonné après désinscription", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    const received: Awaited<ReturnType<typeof repository.getSnapshot>>[] = [];
    const unsubscribe = repository.subscribe("tournoi-des-arcanes", (snapshot) => received.push(snapshot));
    unsubscribe();

    await repository.updateTeam(makeTeam({ name: "Après désinscription" }));
    expect(received).toHaveLength(1);
  });

  it("donne une copie indépendante à chaque abonné", async () => {
    const repository = new MemoryEventRepository(makeEventSnapshot(), {});
    let secondSnapshot: Awaited<ReturnType<typeof repository.getSnapshot>> | undefined;
    repository.subscribe("tournoi-des-arcanes", (snapshot) => { snapshot.teams[0].name = "mutated"; });
    repository.subscribe("tournoi-des-arcanes", (snapshot) => { secondSnapshot = snapshot; });

    await repository.updateTeam(makeTeam({ points: 10 }));
    expect(secondSnapshot?.teams[0].name).toBe("Équipe A");
  });

  it("révèle les participants dans l’ordre avec leur assignment", async () => {
    const participants = [
      makeParticipant({ id: "late", revealOrder: 2 }),
      makeParticipant({ id: "first", revealOrder: 1 }),
    ];
    const repository = new MemoryEventRepository(makeEventSnapshot({ participants }), { first: "team-a" });

    await expect(repository.revealParticipant("event-1", "first")).resolves.toEqual({ participantId: "first", teamId: "team-a" });
    const first = (await repository.getSnapshot("tournoi-des-arcanes")).participants.find((p) => p.id === "first");
    expect(first?.revealedTeamId).toBe("team-a");
    expect(first?.revealedAt).toEqual(expect.any(String));
  });

  it("révèle un participant explicitement et rend son retry idempotent", async () => {
    const participants = [
      makeParticipant({ id: "first", revealOrder: 1 }),
      makeParticipant({ id: "late", revealOrder: 2 }),
    ];
    const repository = new MemoryEventRepository(makeEventSnapshot({ participants }), {
      first: "team-a",
      late: "team-a",
    });

    await expect(repository.revealParticipant("event-1", "late")).rejects.toThrow("not_next_participant");
    const firstReveal = await repository.revealParticipant("event-1", "first");
    expect(firstReveal).toEqual({ participantId: "first", teamId: "team-a" });

    const retryReveal = await repository.revealParticipant("event-1", "first");
    expect(retryReveal).toEqual(firstReveal);
    const afterRetry = await repository.getSnapshot("tournoi-des-arcanes");
    expect(afterRetry.participants.find((participant) => participant.id === "late")?.revealedAt).toBeNull();

    await expect(repository.revealParticipant("event-1", "late")).resolves.toEqual({ participantId: "late", teamId: "team-a" });
  });

  it("considère un participant non horodaté comme non révélé", async () => {
    const participant = makeParticipant({ revealedTeamId: "team-a", revealedAt: null });
    const repository = new MemoryEventRepository(makeEventSnapshot({ participants: [participant] }), { "participant-1": "team-a" });
    await expect(repository.revealParticipant("event-1", "participant-1")).resolves.toEqual({ participantId: "participant-1", teamId: "team-a" });
  });

  it("échoue avec no_participant quand il ne reste personne à révéler", async () => {
    const participant = makeParticipant({ revealedTeamId: "team-a", revealedAt: "2026-01-01T00:00:00.000Z" });
    const repository = new MemoryEventRepository(makeEventSnapshot({ participants: [participant] }), {});
    await expect(repository.revealParticipant("event-1", "missing-participant")).rejects.toThrow("no_participant");
  });
});
