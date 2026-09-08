import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeTeam } from "../../test/fixtures";
import { ScoreControls } from "./ScoreControls";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

describe("ScoreControls", () => {
  afterEach(() => vi.restoreAllMocks());
  it("confirme un score uniquement après succès du dépôt et utilise une clé idempotente", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    const applyScore = vi.fn(() => pending.promise);
    vi.spyOn(crypto, "randomUUID").mockReturnValue("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    render(<ScoreControls team={makeTeam()} applyScore={applyScore} />);

    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));

    expect(applyScore).toHaveBeenCalledWith({
      eventId: "event-1",
      teamId: "team-a",
      points: 10,
      keys: 0,
      source: "manual",
      idempotencyKey: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(screen.getByRole("status")).toHaveTextContent(/enregistrement/i);

    await act(async () => pending.resolve());
    expect(await screen.findByRole("status")).toHaveTextContent(/enregistré/i);
  });

  it("permet d'ajouter et retirer points et clés avec des commandes explicites", async () => {
    const user = userEvent.setup();
    const applyScore = vi.fn().mockResolvedValue(undefined);
    render(<ScoreControls team={makeTeam({ points: 30, keys: 2 })} applyScore={applyScore} />);

    await user.click(screen.getByRole("button", { name: /retirer 10 points/i }));
    await user.click(screen.getByRole("button", { name: /ajouter 1 clé/i }));
    await user.click(screen.getByRole("button", { name: /retirer 1 clé/i }));

    expect(applyScore).toHaveBeenNthCalledWith(1, expect.objectContaining({ points: -10, keys: 0 }));
    expect(applyScore).toHaveBeenNthCalledWith(2, expect.objectContaining({ points: 0, keys: 1 }));
    expect(applyScore).toHaveBeenNthCalledWith(3, expect.objectContaining({ points: 0, keys: -1 }));
  });

  it("valide une valeur libre avant de l'envoyer", async () => {
    const user = userEvent.setup();
    const applyScore = vi.fn().mockResolvedValue(undefined);
    render(<ScoreControls team={makeTeam()} applyScore={applyScore} />);

    const custom = screen.getByRole("group", { name: /ajustement libre/i });
    await user.type(within(custom).getByRole("spinbutton", { name: /points/i }), "abc");
    await user.click(within(custom).getByRole("button", { name: /appliquer/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/valeur entière/i);
    expect(applyScore).not.toHaveBeenCalled();
  });

  it("empêche de retirer plus de clés que l'équipe n'en possède", async () => {
    const user = userEvent.setup();
    const applyScore = vi.fn();
    render(<ScoreControls team={makeTeam({ keys: 0 })} applyScore={applyScore} />);

    expect(screen.getByRole("button", { name: /retirer 1 clé/i })).toBeDisabled();
    expect(applyScore).not.toHaveBeenCalled();
  });

  it("affiche une erreur générique et permet de réessayer avec la même action", async () => {
    const user = userEvent.setup();
    const applyScore = vi.fn()
      .mockRejectedValueOnce(new Error("duplicate key value: secret-id"))
      .mockResolvedValueOnce(undefined);
    render(<ScoreControls team={makeTeam()} applyScore={applyScore} />);

    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/enregistrement impossible/i);
    expect(screen.getByRole("alert")).not.toHaveTextContent(/duplicate|secret-id/i);

    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));
    expect(await screen.findByRole("status")).toHaveTextContent(/enregistré/i);
    expect(applyScore).toHaveBeenCalledTimes(2);
  });

  it("réutilise la clé d'idempotence d'une opération incertaine puis la renouvelle après succès", async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");
    const applyScore = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue(undefined);
    render(<ScoreControls team={makeTeam()} applyScore={applyScore} />);

    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));
    await screen.findByRole("status");
    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));

    expect(applyScore.mock.calls.map(([input]) => input.idempotencyKey)).toEqual([
      "11111111-1111-4111-8111-111111111111",
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
  });

  it("abandonne la clé incertaine lorsqu'une autre opération est choisie explicitement", async () => {
    const user = userEvent.setup();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("33333333-3333-4333-8333-333333333333")
      .mockReturnValueOnce("44444444-4444-4444-8444-444444444444");
    const applyScore = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(undefined);
    render(<ScoreControls team={makeTeam()} applyScore={applyScore} />);

    await user.click(screen.getByRole("button", { name: /ajouter 10 points/i }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /ajouter 1 clé/i }));

    expect(applyScore.mock.calls[0][0].idempotencyKey).toBe("33333333-3333-4333-8333-333333333333");
    expect(applyScore.mock.calls[1][0].idempotencyKey).toBe("44444444-4444-4444-8444-444444444444");
  });
});
