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

  it("révèle les participants dans l’ordre avec leur assignment", async () => {
    const participants = [
      makeParticipant({ id: "late", revealOrder: 2 }),
      makeParticipant({ id: "first", revealOrder: 1 }),
    ];
    const repository = new MemoryEventRepository(makeEventSnapshot({ participants }), { first: "team-a" });

    await expect(repository.revealNextParticipant("event-1")).resolves.toEqual({ participantId: "first", teamId: "team-a" });
    const first = (await repository.getSnapshot("tournoi-des-arcanes")).participants.find((p) => p.id === "first");
    expect(first?.revealedTeamId).toBe("team-a");
    expect(first?.revealedAt).toEqual(expect.any(String));
  });

  it("échoue avec no_participant quand il ne reste personne à révéler", async () => {
    const participant = makeParticipant({ revealedTeamId: "team-a", revealedAt: "2026-01-01T00:00:00.000Z" });
    const repository = new MemoryEventRepository(makeEventSnapshot({ participants: [participant] }), {});
    await expect(repository.revealNextParticipant("event-1")).rejects.toThrow("no_participant");
  });
});
