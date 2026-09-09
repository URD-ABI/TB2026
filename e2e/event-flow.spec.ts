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
  await expect(page.getByTestId("challenge-tile")).toHaveCount(5);

  await page.getByRole("link", { name: "Quiz" }).click();
  await expect(page.getByRole("status")).toContainText(/lancé par l.organisateur/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("l'accès organisateur affiche une connexion exploitable sur petit écran", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await expect(page.getByLabel(/adresse e-mail/i)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
