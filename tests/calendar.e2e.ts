import { test, expect } from "@playwright/test";

test.use({ timezoneId: "America/Los_Angeles" });
test("calendar labels, grouping, navigation and agenda use preference civil dates across browser zones", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-06T06:00:00Z"));
  await page.goto("/calendar");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("dispatch-demo-v1")!);
    state.preferences.timezone = "Europe/Berlin";
    const draft = state.drafts.find(
      (d: { workspaceId: string }) => d.workspaceId === state.activeWorkspaceId,
    );
    draft.title = "Montag im ausgewählten Kalender";
    state.schedules = [
      {
        id: "civil-test",
        draftId: draft.id,
        workspaceId: draft.workspaceId,
        accountId: draft.accountId,
        version: 1,
        text: ["Monday"],
        mediaIds: [],
        at: "2026-10-05T07:00:00.000Z",
        status: "scheduled",
        publishedCount: 0,
      },
    ];
    localStorage.setItem("dispatch-demo-v1", JSON.stringify(state));
  });
  await page.reload();
  const grid = page.locator(".surface .grid.grid-cols-7").last();
  await expect(
    grid
      .locator(":scope > div")
      .nth(0)
      .getByRole("button", { name: /Montag im ausgewählten Kalender/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nächster Zeitraum", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /Montag im ausgewählten Kalender/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(
    grid
      .locator(":scope > div")
      .nth(0)
      .getByRole("button", { name: /Montag im ausgewählten Kalender/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Monat", exact: true }).click();
  await expect(page.getByText("Oktober 2026", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Nächster Zeitraum", exact: true })
    .click();
  await expect(page.getByText("November 2026", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Montag im ausgewählten Kalender/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Montag im ausgewählten Kalender/ }),
  ).toBeVisible();
});
