import { test, expect } from "@playwright/test";
const h = { "X-Requested-With": "FoundIt" };
const unique = () => Date.now() + "-" + Math.random().toString(36).slice(2);
async function account(page: any, name: string) {
  await page.goto("/register");
  const fields = page.locator("input");
  await fields.nth(0).fill(unique() + "@e.ntu.edu.sg");
  await fields.nth(1).fill("password123");
  await fields.nth(2).fill(name);
  await fields.nth(3).fill("@" + name);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/browse/);
}
async function mockMap(page: any, fail = false) {
  await page.route("**/api/onemap/reverse-geocode?**", async (route: any) => {
    if (fail)
      return route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Location service unavailable" }),
      });
    await route.continue();
  });
}
test("registration, account update, protected navigation and server logout", async ({
  page,
}) => {
  await account(page, "BrowserUser");
  await page.getByRole("link", { name: "BrowserUser", exact: true }).click();
  await expect(page.getByText("My account", { exact: true })).toBeVisible();
  await page.locator("input").nth(1).fill("UpdatedName");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your details have been saved.")).toBeVisible();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/claims");
  await expect(page).toHaveURL(/login/);
});
test("location failure keeps report submission disabled", async ({ page }) => {
  await account(page, "MapFailure");
  await page.goto("/lost/new");
  await mockMap(page, true);
  await page
    .locator(".leaflet-container")
    .click({ position: { x: 150, y: 130 } });
  await expect(page.getByText(/Location service unavailable/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit report" }),
  ).toBeDisabled();
});
// This fixture creates a report through the same API; the OneMap response is provided by the test server, not production fallback.
test("two users: create reports, open match score, claim, Finder review, contact exchange", async ({
  browser,
  baseURL,
}) => {
  const owner = await browser.newContext(),
    finder = await browser.newContext();
  const a = await owner.newPage(),
    b = await finder.newPage();
  await account(a, "OwnerE2E");
  await account(b, "FinderE2E");
  const where = await a.request.get(
    "/api/onemap/reverse-geocode?lat=1.34639&lng=103.68194",
  );
  expect(where.ok()).toBeTruthy();
  const loc = await where.json();
  const fields = {
    itemName: "E2E blue bottle " + unique(),
    category: "BOTTLES_CONTAINERS",
    colour: "BLUE",
    brand: "Nike",
    brandUnknown: "false",
    dateLost: "2026-09-01",
    notificationThreshold: "60",
    privateDescription: "Owner secret",
    ...loc,
  };
  const lost = await a.request.post("/api/lost-reports", {
    headers: h,
    multipart: fields,
  });
  expect(lost.ok()).toBeTruthy();
  const l = await lost.json();
  const found = await b.request.post("/api/found-reports", {
    headers: h,
    multipart: {
      ...fields,
      dateFound: "2026-09-01",
      privateDescription: "Finder secret",
      photo: {
        name: "bottle.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGNkYPjPgA0wYRUdtBIAy0MBD1YkjLoAAAAASUVORK5CYII=",
          "base64",
        ),
      },
    },
  });
  expect(found.ok()).toBeTruthy();
  await a.goto("/notifications");
  await a
    .getByRole("button")
    .filter({ hasText: fields.itemName })
    .first()
    .click();
  await expect(a.getByText("Match Score: 100")).toBeVisible();
  await expect(a.getByText("Finder secret", { exact: true })).toHaveCount(0);
  await a.getByRole("button", { name: "Claim this item", exact: true }).click();
  await expect(a).toHaveURL(/claims\//);
  await expect(a.getByText(/Waiting for FinderE2E/)).toBeVisible();
  await b.goto("/claims");
  await b
    .getByRole("link")
    .filter({ hasText: fields.itemName })
    .first()
    .click();
  await expect(b.getByText("Owner secret", { exact: true })).toBeVisible();
  await expect(b.getByText("Finder secret", { exact: true })).toBeVisible();
  b.on("dialog", (d) => d.accept());
  await b.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(b.getByText("Claim approved", { exact: true })).toBeVisible();
  await expect(b.getByText("@OwnerE2E", { exact: true })).toBeVisible();
  await a.reload();
  await expect(a.getByText("@FinderE2E", { exact: true })).toBeVisible();
  await owner.close();
  await finder.close();
});
