import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
});

test("shows three vessel markers", async ({ page }) => {
  await expect(page.locator("[data-vessel-id]")).toHaveCount(3);
});

test("selecting a vessel opens its card and repeat click keeps it open", async ({ page }) => {
  const vessel = page.locator("[data-vessel-id]").first();
  const vesselId = await vessel.getAttribute("data-vessel-id");
  expect(vesselId).not.toBeNull();

  await vessel.click();

  const card = page.getByRole("region", { name: "Карточка судна" });
  await expect(card.getByRole("heading", { name: vesselId! })).toBeVisible();

  await vessel.click();
  await expect(card.getByRole("heading", { name: vesselId! })).toBeVisible();
});
