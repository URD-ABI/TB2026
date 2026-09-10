import { expect, test } from "@playwright/test";

test("les quatre espaces de l'événement restent accessibles et sans débordement", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Classement" })).toBeVisible();
  await expect(page.getByTestId("team-cylinder")).toHaveCount(5);

  await page.getByRole("link", { name: "Attribution" }).click();
  await expect(page.getByRole("heading", { name: "Attribution des équipes" })).toBeVisible();
  await expect(page.getByTestId("team-composition")).toHaveCount(5);

  await page.getByRole("link", { name: "Défis" }).click();
  await expect(page.getByRole("heading", { name: "Les cinq défis" })).toBeVisible();
  await expect(page.getByTestId("challenge-tile")).toHaveCount(1);
  await expect(page.locator(".challenges-carousel__indicator")).toHaveCount(5);

  await page.getByRole("link", { name: "Quiz" }).click();
  await expect(page.getByRole("status")).toContainText(/lancé par l.organisateur/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("le carrousel des défis tient dans les écrans de projection sans défilement", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablette-820", "Le défilement reste autorisé sur les écrans étroits.");

  await page.goto("/defis");
  await expect(page.getByRole("heading", { name: "Les cinq défis" })).toBeVisible();
  await expect(page.getByTestId("challenge-tile")).toBeVisible();

  const accessibleStatus = page.locator(".challenges-carousel .visually-hidden");
  await expect(accessibleStatus).toContainText(/Défi \d sur 5/);
  const statusBox = await accessibleStatus.boundingBox();
  expect(statusBox).not.toBeNull();
  expect(statusBox?.width).toBeLessThanOrEqual(1);
  expect(statusBox?.height).toBeLessThanOrEqual(1);

  const layout = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    carouselBottom: document.querySelector(".challenges-carousel")?.getBoundingClientRect().bottom ?? Infinity,
  }));

  expect(layout.documentHeight).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.carouselBottom).toBeLessThanOrEqual(layout.viewportHeight);
});

test("l'accès organisateur affiche une connexion exploitable sur petit écran", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(page.getByLabel(/adresse e-mail/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
