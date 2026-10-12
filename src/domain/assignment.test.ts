import { describe, expect, it } from "vitest";
import { makeParticipant } from "../test/fixtures";
import { buildReelSequence, nextParticipant } from "./assignment";

describe("nextParticipant", () => {
  it("sélectionne le premier participant non révélé selon revealOrder", () => {
    const participants = [
      makeParticipant({ id: "revealed-2", revealOrder: 2, revealedAt: "2026-12-01T10:00:00Z", revealedTeamId: "team-b" }),
      makeParticipant({ id: "waiting-3", revealOrder: 3 }),
      makeParticipant({ id: "waiting-1", revealOrder: 1 }),
    ];

    expect(nextParticipant(participants)?.id).toBe("waiting-1");
  });

  it("ne modifie pas l’ordre du tableau reçu", () => {
    const participants = [
      makeParticipant({ id: "waiting-3", revealOrder: 3 }),
      makeParticipant({ id: "waiting-1", revealOrder: 1 }),
      makeParticipant({ id: "waiting-2", revealOrder: 2 }),
    ];
    const originalOrder = participants.map(({ id }) => id);

    nextParticipant(participants);

    expect(participants.map(({ id }) => id)).toEqual(originalOrder);
  });

  it("renvoie null lorsque tous les participants ont déjà été révélés", () => {
    const participants = [
      makeParticipant({ id: "revealed-1", revealOrder: 1, revealedAt: "2026-12-01T10:00:00Z", revealedTeamId: "team-a" }),
      makeParticipant({ id: "revealed-2", revealOrder: 2, revealedAt: "2026-12-01T10:01:00Z", revealedTeamId: "team-b" }),
    ];

    expect(nextParticipant(participants)).toBeNull();
  });
});

describe("buildReelSequence", () => {
  it("parcourt plusieurs fois chacune des cinq équipes avant la phase finale", () => {
    const teamIds = ["team-a", "team-b", "team-c", "team-d", "team-e"];

    const sequence = buildReelSequence(teamIds, "team-c");
    const spinningSteps = sequence.filter((step) => step.phase === "spinning");

    for (const teamId of teamIds) {
      expect(spinningSteps.filter((step) => step.teamId === teamId).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("ralentit avec des délais strictement croissants jusqu’à l’équipe renvoyée par la RPC", () => {
    const sequence = buildReelSequence(
      ["team-a", "team-b", "team-c", "team-d", "team-e"],
      "team-d",
    );
    const settlingSteps = sequence.filter((step) => step.phase === "settling");

    expect(settlingSteps.length).toBeGreaterThan(1);
    expect(settlingSteps.at(-1)?.teamId).toBe("team-d");
    for (let index = 1; index < settlingSteps.length; index += 1) {
      expect(settlingSteps[index].delayMs).toBeGreaterThan(settlingSteps[index - 1].delayMs);
    }
  });
});
