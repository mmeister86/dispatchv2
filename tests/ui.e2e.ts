import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("every UI area and direct URL renders without client errors", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(baseURL!))
      remoteRequests.push(request.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  const routes = [
    "/overview",
    "/drafts",
    "/drafts/draft-1",
    "/ideas",
    "/signals",
    "/plans",
    "/calendar",
    "/calendar?view=month",
    "/calendar?view=agenda",
    "/research",
    "/agent",
    "/analytics",
    "/media",
    "/experiments",
    "/repurpose",
    "/trends",
    "/team",
    "/operations",
    "/settings/profile",
    "/settings/workspaces",
    "/settings/sources",
    "/settings/integrations",
    "/settings/strategy",
    "/settings/notifications",
    "/settings/billing",
    "/settings/data",
    "/settings/automation",
    "/welcome",
    "/login",
    "/signup",
    "/verify",
    "/reset-password",
    "/onboarding",
    "/help",
    "/legal",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText("Diese Ansicht konnte nicht geladen werden"),
    ).toHaveCount(0);
  }
  expect(errors).toEqual([]);
  expect(remoteRequests).toEqual([]);
});
test("two selected proposals make exactly two persistent calendar snapshots", async ({
  page,
}) => {
  await page.goto("/plans");
  await page.getByRole("button", { name: "Demo-Vorschläge erstellen" }).click();
  await expect(
    page.getByRole("button", { name: "Version freigeben", exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole("button", { name: "Version freigeben", exact: true })
    .nth(0)
    .click();
  await page
    .getByRole("button", { name: "Version freigeben", exact: true })
    .nth(1)
    .click();
  const choices = page.getByRole("checkbox", {
    name: /Vorschlag .* auswählen/,
  });
  await choices.nth(0).check();
  await choices.nth(1).check();
  await page
    .getByRole("button", { name: "Ausgewählte Slots annehmen" })
    .click();
  await expect(
    page.getByText("Termin angenommen", { exact: true }),
  ).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByText("Termin angenommen", { exact: true }),
  ).toHaveCount(2);
  const slots = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dispatch-demo-v1")!).schedules.filter(
      (s: { status: string }) => s.status === "scheduled",
    ),
  );
  expect(slots).toHaveLength(4);
});
test("composer editing invalidates approval while scheduled snapshot remains untouched", async ({
  page,
}) => {
  await page.goto("/drafts/draft-2");
  await page
    .getByLabel("Text Beitrag 1")
    .fill("Ein neuer Gedanke. Die alte geplante Version bleibt bestehen.");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByText("Diese Arbeitsversion ist noch nicht freigegeben"),
  ).toBeVisible();
  await expect(page.getByText(/Geplant: v1/)).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dispatch-demo-v1")!),
  );
  const d = data.drafts.find((d: { id: string }) => d.id === "draft-2");
  const s = data.schedules.find(
    (s: { draftId: string }) => s.draftId === "draft-2",
  );
  expect(d.versions.at(-1).number).toBe(2);
  expect(s.version).toBe(1);
  expect(s.text[0]).not.toContain("Ein neuer Gedanke");
  await page.reload();
  await expect(page.getByLabel("Text Beitrag 1")).toHaveValue(
    "Ein neuer Gedanke. Die alte geplante Version bleibt bestehen.",
  );
});
test("analysis stays bound to identity and recommendations create an unapproved version", async ({
  page,
}) => {
  await page.goto("/drafts/draft-1");
  await page.getByRole("tab", { name: "Intelligence" }).click();
  await page.getByRole("button", { name: "Beispielanalyse ansehen" }).click();
  await expect(page.getByText("Solide Grundlage")).toBeVisible();
  await page.getByRole("button", { name: "Änderung prüfen" }).first().click();
  await page.getByRole("button", { name: "Bewusst übernehmen" }).click();
  await expect(
    page.getByText("Diese Arbeitsversion ist noch nicht freigegeben"),
  ).toBeVisible();
  await expect(page.getByText(/Ergebnis ist veraltet/)).toBeVisible();
  await page.goto("/drafts/draft-4");
  await page.getByRole("tab", { name: "Intelligence" }).click();
  await expect(page.getByText("Solide Grundlage")).toHaveCount(0);
  await expect(page.getByText(/Keine KI-Aufrufe/)).toBeVisible();
});
test("multi-channel variants retain thread structure and use independent approval", async ({
  page,
}) => {
  await page.goto("/drafts/draft-5");
  await page
    .getByRole("button", { name: "Separate Kanalvariante erstellen" })
    .click();
  await page
    .getByLabel("Ziel-Account der Variante")
    .selectOption("acc-linkedin");
  await page
    .getByRole("button", { name: "Variante erstellen", exact: true })
    .click();
  await expect(page.getByLabel("Text Beitrag 4")).toBeVisible();
  await expect(
    page.getByText("Diese Arbeitsversion ist noch nicht freigegeben"),
  ).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dispatch-demo-v1")!),
  );
  expect(data.drafts[0].versions[0].text).toHaveLength(4);
  expect(data.drafts[0].accountId).toBe("acc-linkedin");
  expect(data.drafts[0].approval).toBeUndefined();
  expect(data.drafts[0].packageId).toBeTruthy();
});
test("ambiguous and non-existent wall clock time are exposed before scheduling", async ({
  page,
}) => {
  await page.goto("/drafts/draft-1");
  await page
    .getByRole("button", { name: "Version freigeben", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Version planen", exact: true })
    .click();
  await page.getByLabel("Datum und Uhrzeit").fill("2026-10-25T02:30");
  await expect(
    page.getByText("Uhrzeit ist wegen Zeitumstellung mehrdeutig"),
  ).toBeVisible();
  await page.getByLabel("Datum und Uhrzeit").fill("2026-03-29T02:30");
  await expect(
    page.getByText("Ungültiger oder nicht existierender Zeitpunkt."),
  ).toBeVisible();
});
test("mobile navigation reaches editor and pages fit viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview");
  await page.getByRole("button", { name: "Navigation öffnen" }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Entwürfe/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deine Entwürfe" }),
  ).toBeVisible();
  for (const route of [
    "/overview",
    "/drafts/draft-1",
    "/research",
    "/team",
    "/settings/profile",
    "/analytics",
    "/media",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll, route).toBeLessThanOrEqual(dimensions.width + 1);
  }
});
test("all primary screens have no serious WCAG accessibility violations", async ({
  page,
}) => {
  test.setTimeout(120000);
  for (const route of [
    "/overview",
    "/drafts/draft-1",
    "/calendar?view=agenda",
    "/research",
    "/team",
    "/settings/profile",
    "/login",
    "/ideas",
    "/signals",
    "/plans",
    "/agent",
    "/analytics",
    "/media",
    "/experiments",
    "/repurpose",
    "/trends",
    "/operations",
    "/settings/workspaces",
    "/settings/integrations",
    "/settings/sources",
    "/settings/strategy",
    "/settings/notifications",
    "/settings/billing",
    "/settings/automation",
    "/settings/data",
    "/welcome",
    "/signup",
    "/verify",
    "/reset-password",
    "/onboarding",
    "/help",
    "/legal",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      route,
    ).toEqual([]);
  }
});

test("all route transitions protect unsaved composer changes", async ({
  page,
}) => {
  await page.goto("/drafts");
  await page
    .getByRole("link", { name: /Was wir aus 100 Gesprächen gelernt haben/ })
    .click();
  await page.getByLabel("Text Beitrag 1").fill("Mein ungespeicherter Gedanke");
  await page.getByRole("link", { name: "Ideen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ungespeicherte Änderungen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await expect(page.getByLabel("Text Beitrag 1")).toHaveValue(
    "Mein ungespeicherter Gedanke",
  );
  await page.getByRole("button", { name: "Profilmenü" }).click();
  await page.getByRole("menuitem", { name: "Produktseite ansehen" }).click();
  await expect(
    page.getByRole("heading", { name: "Ungespeicherte Änderungen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await page.evaluate(() => history.back());
  await expect(
    page.getByRole("heading", { name: "Ungespeicherte Änderungen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Weiter bearbeiten" }).click();
  await expect(page).toHaveURL(/drafts\/draft-2$/);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Aktiver Account").selectOption("acc-linkedin");
  await page.getByRole("button", { name: "Profilmenü" }).click();
  await page.getByRole("menuitem", { name: "Profil & Workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Ungespeicherte Änderungen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Änderungen verwerfen" }).click();
  await expect(page).toHaveURL(/settings\/profile$/);
});

test("quota errors do not report successful saves or create missing draft references", async ({
  page,
}) => {
  const fillStorage = async () =>
    page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === "dispatch-demo-v1")
          throw new DOMException("Full", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
  await page.goto("/drafts/draft-2");
  await fillStorage();
  await page.getByLabel("Text Beitrag 1").fill("Nicht gespeicherte Änderung");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByText(/Änderung wurde nicht gespeichert/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Speichern", exact: true }),
  ).toBeEnabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dispatch-demo-v1")!)
      .drafts.find((d: { id: string }) => d.id === "draft-2")
      .versions.at(-1),
  );
  expect(saved.number).toBe(1);
  await page.goto("/drafts/draft-2");
  await fillStorage();
  await page
    .getByRole("button", { name: "Separate Kanalvariante erstellen" })
    .click();
  await page
    .getByLabel("Ziel-Account der Variante")
    .selectOption("acc-linkedin");
  await page
    .getByRole("button", { name: "Variante erstellen", exact: true })
    .click();
  await expect(
    page.getByText(/Änderung wurde nicht gespeichert/),
  ).toBeVisible();
  await expect(page).toHaveURL(/drafts\/draft-2$/);
  await expect(page.getByText("Entwurf nicht gefunden")).toHaveCount(0);
  await page.goto("/plans");
  await fillStorage();
  await page.getByRole("button", { name: "Demo-Vorschläge erstellen" }).click();
  await expect(
    page.getByText(/Änderung wurde nicht gespeichert/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Version freigeben", exact: true }),
  ).toHaveCount(0);
});

test("a scheduled X snapshot cannot be replaced after switching its working draft to LinkedIn", async ({
  page,
}) => {
  await page.goto("/drafts/draft-2");
  await page
    .getByLabel("Account", { exact: true })
    .selectOption("acc-linkedin");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page
    .getByRole("button", { name: "Version freigeben", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Geplante Version ersetzen" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Account geändert: Den bisherigen Slot/),
  ).toBeVisible();
  const slot = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dispatch-demo-v1")!).schedules.find(
      (s: { id: string }) => s.id === "slot-1",
    ),
  );
  expect(slot.accountId).toBe("acc-x");
  expect(slot.version).toBe(1);
});

test("evidence captures desktop editor, overview and mobile overview", async ({
  page,
}) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.screenshot({
    path: ".docs/reviews/evidence/task-69/overview-desktop.png",
    fullPage: true,
  });
  await page.goto("/drafts/draft-2");
  await page.screenshot({
    path: ".docs/reviews/evidence/task-69/composer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/overview");
  await page.screenshot({
    path: ".docs/reviews/evidence/task-69/overview-mobile.png",
    fullPage: true,
  });
});

test("editor save and global search work with keyboard shortcuts and restore focus", async ({
  page,
}) => {
  await page.goto("/drafts/draft-1");
  await page
    .getByLabel("Text Beitrag 1")
    .fill("Ein Gedanke, per Tastatur gespeichert.");
  await page.keyboard.press("Control+s");
  await expect(
    page.getByRole("button", { name: "Speichern", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Suche öffnen" }).focus();
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Workspace-Suche")).toBeFocused();
  await page.getByLabel("Workspace-Suche").fill("Analytics");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Analytics", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Analytics", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Suche öffnen" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Suche öffnen" }),
  ).toBeFocused();
});

test("dark design persists across routes with readable core and public screens", async ({
  page,
}) => {
  await page.goto("/overview");
  await page.getByRole("button", { name: "Dunkles Design aktivieren" }).click();
  const violations = [];
  for (const route of [
    "/overview",
    "/drafts/draft-1",
    "/analytics",
    "/settings/billing",
    "/login",
    "/welcome",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    violations.push(
      ...result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ route, id: v.id, nodes: v.nodes.map((n) => n.target) })),
    );
  }
  expect(violations).toEqual([]);
});

test("deferred onboarding remains incomplete and can resume from profile settings", async ({
  page,
}) => {
  await page.goto("/onboarding?returnTo=%2Fsettings%2Fprofile");
  await page
    .getByLabel("Was macht dein Projekt?")
    .fill("Saved project context");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Wie klingt deine Stimme?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Später einrichten" }).click();
  await expect(page).toHaveURL(/\/settings\/profile$/);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dispatch-demo-v1")!),
  );
  expect(saved.preferences.onboardingDone).toBe(false);
  expect(
    saved.workspaces.find(
      (w: { id: string }) => w.id === saved.activeWorkspaceId,
    ).description,
  ).toBe("Saved project context");
  await page.getByRole("link", { name: "Einrichtung fortsetzen" }).click();
  await expect(
    page.getByRole("heading", { name: "Wie klingt deine Stimme?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Später einrichten" }).click();
  await page.goto("/overview");
  await expect(
    page.getByRole("link", { name: "Einrichtung fortsetzen" }),
  ).toBeVisible();
});
