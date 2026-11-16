import { expect, test } from "@playwright/test";

const frozenTime = new Date("2026-01-01T12:00:00.000Z");

const snapshotVesselWithoutMotion = {
  id: "987654321",
  name: "SYNTHETIC SNAPSHOT VESSEL",
  lat: 50.95,
  lon: 1.42,
  speedKnots: null,
  courseDeg: null,
  timestamp: "2026-01-01T11:59:59.000Z",
  source: "aisstream",
};

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: frozenTime });
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
});

test("demo vessel moves and its selected card follows the new position", async ({ page }) => {
  await page.goto("/");

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await expect(marker).toBeVisible();
  await marker.click();

  const card = page.getByRole("region", { name: "Карточка судна" });
  await expect(card.getByText("50.88000, 1.12000")).toBeVisible();

  await page.clock.runFor(6000);

  await expect(card.getByText("50.92500, 1.30000")).toBeVisible();
  await expect(card.getByText("12:00:06 UTC")).toBeVisible();
});

test("demo vessel stops at the route end and keeps the last step in its card", async ({ page }) => {
  await page.goto("/");

  const marker = page.locator('[data-vessel-id="demo-1"]');
  await marker.click();
  const card = page.getByRole("region", { name: "Карточка судна" });

  await page.clock.runFor(18_000);

  await expect(card.getByText("51.02000, 1.68000")).toBeVisible();
  await expect(card.getByText("0 уз", { exact: true })).toBeVisible();
  await expect(card.getByText("68°", { exact: true })).toBeVisible();
  await expect(card.getByText("12:00:18 UTC")).toBeVisible();

  await page.clock.runFor(2000);

  await expect(card.getByText("51.02000, 1.68000")).toBeVisible();
  await expect(card.getByText("12:00:18 UTC")).toBeVisible();
});

test("snapshot error clears vessels and shows the agreed error state", async ({ page }) => {
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        attemptedAt: "2026-01-01T12:00:00.000Z",
        error: { code: "connect_failed", message: "Не удалось подключиться к источнику" },
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Загрузить настоящие позиции" }).click();

  await expect(page.locator("[data-vessel-id]")).toHaveCount(0);
  await expect(page.getByText("Данных на карте нет")).toBeVisible();
  await expect(page.locator('p[role="alert"]')).toHaveText(
    "Не удалось получить данные: Не удалось подключиться к источнику",
  );
});

test("empty snapshot shows the count and explains that no positions arrived", async ({ page }) => {
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        vessels: [],
        collectedAt: "2026-01-01T12:00:15.000Z",
        windowSeconds: 15,
        count: 0,
        truncated: false,
        reason: "window_elapsed",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Загрузить настоящие позиции" }).click();

  await expect(page.locator("[data-vessel-id]")).toHaveCount(0);
  await expect(page.locator(".source-label")).toContainText("судов: 0");
  await expect(page.getByRole("status")).toHaveText("За время сбора позиции не получены");
});

test("snapshot with unknown speed and course displays Нет данных and a neutral icon", async ({ page }) => {
  await page.route("**/api/snapshot", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        vessels: [snapshotVesselWithoutMotion],
        collectedAt: "2026-01-01T12:00:15.000Z",
        windowSeconds: 15,
        count: 1,
        truncated: false,
        reason: "window_elapsed",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Загрузить настоящие позиции" }).click();

  const marker = page.locator('[data-vessel-id="987654321"][data-icon="neutral"]');
  await expect(marker).toBeVisible();
  await marker.click();

  const card = page.getByRole("region", { name: "Карточка судна" });
  await expect(card.getByText("Нет данных", { exact: true })).toHaveCount(2);
  await expect(card.getByText("0 уз", { exact: true })).toHaveCount(0);
  await expect(card.getByText("0°", { exact: true })).toHaveCount(0);
});
