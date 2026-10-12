import { act } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "../../app/AppProviders";
import type { Team } from "../../domain/types";
import { MemoryEventRepository } from "../../repositories/MemoryEventRepository";
import { makeEvent, makeEventSnapshot, makeTeam } from "../../test/fixtures";
import { RankingPage } from "./RankingPage";

const EVENT_SLUG = "tournoi-des-arcanes";

function fiveTeams(overrides: Partial<Team>[] = []): Team[] {
  const defaults: Partial<Team>[] = [
    { id: "team-a", name: "Lynx d’argent", displayOrder: 0, points: 100, keys: 1 },
    { id: "team-b", name: "Hiboux de givre", displayOrder: 1, points: 80, keys: 2 },
    { id: "team-c", name: "Cerfs dorés", displayOrder: 2, points: 60, keys: 3 },
    { id: "team-d", name: "Renards de braise", displayOrder: 3, points: 40, keys: 4 },
    { id: "team-e", name: "Loups des mers", displayOrder: 4, points: 20, keys: 5 },
  ];

  return defaults.map((team, index) => makeTeam({
    ...team,
    ...overrides[index],
  }));
}

function renderRanking(teams: Team[], scoreCapacity = 100) {
  const repository = new MemoryEventRepository(makeEventSnapshot({
    event: makeEvent({ scoreCapacity }),
    teams,
  }), {});
  const view = render(
    <AppProviders repository={repository} eventSlug={EVENT_SLUG}>
      <RankingPage />
    </AppProviders>,
  );

  return { ...view, repository };
}

function rankMarker(cylinder: HTMLElement): HTMLElement {
  const marker = cylinder.querySelector<HTMLElement>(".team-cylinder__rank");
  if (!marker) throw new Error("Marqueur de rang introuvable");
  return marker;
}

describe("RankingPage", () => {
  it("affiche exactement les cinq cylindres fournis par le contexte de l’événement", async () => {
    renderRanking(fiveTeams());

    expect(await screen.findAllByTestId("team-cylinder")).toHaveLength(5);
  });

  it("conserve l’ordre visuel displayOrder même lorsque le classement est différent", async () => {
    const teams = fiveTeams([
      { points: 10 },
      { points: 90 },
      { points: 30 },
      { points: 70 },
      { points: 50 },
    ]);
    renderRanking([teams[3], teams[1], teams[4], teams[0], teams[2]]);

    const cylinders = await screen.findAllByTestId("team-cylinder");
    expect(cylinders.map((cylinder) => within(cylinder).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "Lynx d’argent",
      "Hiboux de givre",
      "Cerfs dorés",
      "Renards de braise",
      "Loups des mers",
    ]);
    for (const cylinder of cylinders) expect(cylinder).not.toHaveTextContent("✦");
    expect(cylinders.map((cylinder) => rankMarker(cylinder).textContent)).toEqual(["5", "1", "4", "2", "3"]);
  });

  it("calcule les rangs par points, puis clés, puis priorité de départage", async () => {
    renderRanking(fiveTeams([
      { points: 100, keys: 1, tieBreakPriority: null },
      { points: 100, keys: 2, tieBreakPriority: null },
      { points: 100, keys: 2, tieBreakPriority: 2 },
      { points: 100, keys: 2, tieBreakPriority: 1 },
      { points: 20, keys: 9, tieBreakPriority: null },
    ]));

    const cylinders = await screen.findAllByTestId("team-cylinder");
    expect(cylinders.map((cylinder) => rankMarker(cylinder).textContent)).toEqual(["4", "3", "2", "1", "5"]);
  });

  it("actualise uniquement les numéros de rang quand les scores changent", async () => {
    const teams = fiveTeams();
    const { repository } = renderRanking(teams);
    const before = await screen.findAllByTestId("team-cylinder");
    expect(before.map((cylinder) => rankMarker(cylinder).textContent)).toEqual(["1", "2", "3", "4", "5"]);

    await act(() => repository.updateTeam({ ...teams[4], points: 120, keys: 0 }));

    const after = screen.getAllByTestId("team-cylinder");
    expect(after.map((cylinder) => within(cylinder).getByRole("heading", { level: 2 }).textContent)).toEqual([
      "Lynx d’argent",
      "Hiboux de givre",
      "Cerfs dorés",
      "Renards de braise",
      "Loups des mers",
    ]);
    expect(after.map((cylinder) => rankMarker(cylinder).textContent)).toEqual(["2", "3", "4", "5", "1"]);
  });

  it("signale de façon accessible chaque égalité qui nécessite une épreuve de départage", async () => {
    renderRanking(fiveTeams([
      { points: 100, keys: 3, tieBreakPriority: null },
      { points: 100, keys: 3, tieBreakPriority: null },
      { points: 70, keys: 2 },
      { points: 50, keys: 1 },
      { points: 20, keys: 0 },
    ]));

    const cylinders = await screen.findAllByTestId("team-cylinder");
    expect(rankMarker(cylinders[0])).toHaveTextContent(/^1$/);
    expect(rankMarker(cylinders[1])).toHaveTextContent(/^1$/);
    expect(within(cylinders[0]).getByRole("status")).toHaveTextContent(/départage requis/i);
    expect(within(cylinders[1]).getByRole("status")).toHaveTextContent(/départage requis/i);
    expect(within(cylinders[2]).queryByText(/départage requis/i)).not.toBeInTheDocument();
  });

  it("place un numéro seul au-dessus de la colonne et distingue les podiums or, argent et bronze", async () => {
    renderRanking(fiveTeams());

    const cylinders = await screen.findAllByTestId("team-cylinder");
    const expectedPodiumClasses = ["rank-gold", "rank-silver", "rank-bronze"];
    expectedPodiumClasses.forEach((podiumClass, index) => {
      const marker = rankMarker(cylinders[index]);
      const glass = cylinders[index].querySelector(".team-cylinder__glass");

      expect(marker).toHaveTextContent(new RegExp(`^${index + 1}$`));
      expect(marker).toHaveAttribute("data-appearance", "number-only");
      expect(marker).toHaveAttribute("aria-label", `Place ${index + 1}`);
      expect(marker.childElementCount).toBe(0);
      expect(cylinders[index]).toHaveClass(`rank-${index + 1}`, podiumClass);
      expect(glass).not.toBeNull();
      expect(marker.compareDocumentPosition(glass as Element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(cylinders[3]).not.toHaveClass("rank-gold", "rank-silver", "rank-bronze");
    expect(cylinders[4]).not.toHaveClass("rank-gold", "rank-silver", "rank-bronze");
  });

  it("centre l’identité sous chaque colonne et affiche points ainsi que la bonne forme de clé", async () => {
    renderRanking(fiveTeams([
      { points: 101, keys: 1 },
      { points: 88, keys: 0 },
    ]));

    const cylinders = await screen.findAllByTestId("team-cylinder");
    const firstGlass = cylinders[0].querySelector(".team-cylinder__glass");
    const firstName = within(cylinders[0]).getByRole("heading", { level: 2, name: "Lynx d’argent" });

    expect(firstName).toHaveClass("team-cylinder__name");
    expect(firstGlass).not.toBeNull();
    expect((firstGlass as Element).compareDocumentPosition(firstName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(cylinders[0]).getByText("101 points")).toBeInTheDocument();
    expect(within(cylinders[0]).getByText("1 clé")).toBeInTheDocument();
    expect(within(cylinders[1]).getByText("88 points")).toBeInTheDocument();
    expect(within(cylinders[1]).getByText("0 clés")).toBeInTheDocument();
  });

  it("borne le sable magique entre 0 % et 100 % relativement à la capacité fixe", async () => {
    renderRanking(fiveTeams([
      { points: 100 },
      { points: 50 },
      { points: 25 },
      { points: 0 },
      { points: -20 },
    ]));

    const cylinders = await screen.findAllByTestId("team-cylinder");
    expect(cylinders.map((cylinder) => cylinder.style.getPropertyValue("--fill"))).toEqual([
      "100%",
      "50%",
      "25%",
      "0%",
      "0%",
    ]);
    for (const cylinder of cylinders) {
      const grains = cylinder.querySelector(".team-cylinder__grains");
      expect(grains).not.toBeNull();
      expect(grains).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("conserve au moins 4 % de sable pour tout score strictement positif", async () => {
    renderRanking(fiveTeams([
      { points: 1000 },
      { points: 1 },
      { points: 0 },
      { points: -1 },
      { points: 500 },
    ]), 1000);

    const cylinders = await screen.findAllByTestId("team-cylinder");
    expect(cylinders.map((cylinder) => cylinder.style.getPropertyValue("--fill"))).toEqual([
      "100%",
      "4%",
      "0%",
      "0%",
      "50%",
    ]);
  });

  it("utilise la capacité de l’événement indépendamment du meilleur score", async () => {
    renderRanking(fiveTeams([
      { points: 150 },
      { points: 100 },
      { points: 50 },
      { points: 1 },
      { points: 0 },
    ]), 100);

    const cylinders = await screen.findAllByTestId("team-cylinder");
    expect(cylinders.map((cylinder) => cylinder.style.getPropertyValue("--fill"))).toEqual([
      "100%", "100%", "50%", "4%", "0%",
    ]);
    expect(within(cylinders[0]).getByText("150 points")).toBeInTheDocument();
    expect(within(cylinders[2]).getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "50 % de la capacité de 100 points",
    );
  });

  it("reste lisible par les technologies d’assistance", async () => {
    renderRanking(fiveTeams());

    expect(await screen.findByRole("heading", { level: 1, name: /classement/i })).toBeInTheDocument();
    for (const team of fiveTeams()) {
      expect(screen.getByRole("article", { name: new RegExp(team.name, "i") })).toBeInTheDocument();
    }
  });
});
