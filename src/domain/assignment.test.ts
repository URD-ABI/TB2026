import { describe, expect, it } from "vitest";
import { makeParticipant } from "../test/fixtures";
import { nextParticipant } from "./assignment";

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
