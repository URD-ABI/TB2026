import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeTeam } from "../../test/fixtures";
import { ScoreHistory } from "./ScoreHistory";

describe("ScoreHistory", () => {
  it("ne permet d'annuler qu'une opération encore active", async () => {
    const user = userEvent.setup(); const reverse = vi.fn().mockResolvedValue(undefined);
    render(<ScoreHistory teams={[makeTeam()]} events={[
      { id: "score-1", eventId: "event-1", teamId: "team-a", pointsDelta: 10, keysDelta: 0, source: "défi", createdAt: "2026-12-18T10:00:00Z", reversedAt: null },
      { id: "score-2", eventId: "event-1", teamId: "team-a", pointsDelta: 5, keysDelta: 1, source: "quiz", createdAt: "2026-12-18T11:00:00Z", reversedAt: "2026-12-18T11:05:00Z" },
    ]} onReverse={reverse} />);
    expect(screen.getAllByRole("button", { name: /annuler/i })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /annuler/i }));
    expect(reverse).toHaveBeenCalledWith("score-1");
  });
});
