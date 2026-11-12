import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
});

test("shows three vessel markers", async ({ page }) => {
  await expect(page.locator("[data-vessel-id]")).toHaveCount(3);
});

test("clicking a vessel opens its card with the vessel id", async ({ page }) => {
  const vessel = page.locator("[data-vessel-id]").first();
  const vesselId = await vessel.getAttribute("data-vessel-id");
  expect(vesselId).not.toBeNull();

  await vessel.click();

  const card = page.getByRole("region", { name: "Карточка судна" });
  await expect(card.getByRole("heading", { name: vesselId! })).toBeVisible();
});

test("clicking the selected vessel again does not close its card", async ({ page }) => {
  const vessel = page.locator("[data-vessel-id]").first();
  const vesselId = await vessel.getAttribute("data-vessel-id");
  expect(vesselId).not.toBeNull();

  await vessel.click();

  const card = page.getByRole("region", { name: "Карточка судна" });
  const heading = card.getByRole("heading", { name: vesselId! });
  await expect(heading).toBeVisible();

  await vessel.click();
  await expect(heading).toBeVisible();
});
