import { test, expect, type Page } from "@playwright/test";
import type { AppState } from "../src/lib/model";

const STORE_KEY = "dispatch-demo-v1";
const researchKey = (area: string, account = "acc-x") =>
  `dispatch-ws-studio-research-${area}-${account}`;

async function stateOf(page: Page): Promise<AppState> {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    STORE_KEY,
  );
}

async function localValue<T>(page: Page, key: string): Promise<T> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key);
}

test("research demo result preserves sources and hands off exactly one idea and draft", async ({
  page,
}) => {
  await page.goto("/research");
  const baseline = await stateOf(page);
  await page
    .getByRole("button", { name: "Demo-Recherche starten", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await localValue<{ status: string }[]>(page, researchKey("runs")))[0]
          .status,
    )
    .toBe("completed");
  await expect(
    page.getByText("Was die Quelle behauptet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unsere Interpretation", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Als Idee speichern", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Als Idee speichern", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Als Idee speichern", exact: true }),
  ).toBeDisabled();
  const afterIdea = await stateOf(page);
  expect(afterIdea.ideas).toHaveLength(baseline.ideas.length + 1);
  expect(afterIdea.ideas[0].source).toContain(
    "https://example.com/research/product-focus",
  );
  await page
    .getByRole("button", { name: "Als Entwurf verwenden", exact: true })
    .click();
  await expect(page).toHaveURL(/\/drafts\/draft-/);
  const url = page.url();
  const afterDraft = await stateOf(page);
  expect(afterDraft.drafts).toHaveLength(baseline.drafts.length + 1);
  expect(afterDraft.drafts[0].source).toContain("Interpretation:");
  expect(afterDraft.drafts[0].approval).toBeUndefined();
  await page.goto("/research");
  await page
    .getByRole("button", { name: "Entwurf öffnen", exact: true })
    .click();
  await expect(page).toHaveURL(url);
  expect((await stateOf(page)).drafts).toHaveLength(afterDraft.drafts.length);
});

test("research run uses its profile snapshot and account profiles remain separate", async ({
  page,
}) => {
  await page.goto("/research");
  await page.getByRole("tab", { name: "Rechercheprofil", exact: true }).click();
  await page.getByLabel("Gewünschte Fundstücke", { exact: true }).fill("1");
  await page.getByLabel("Demo-Budget pro Lauf (€)", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Demo-Recherche starten", exact: true })
    .click();
  await page.getByLabel("Gewünschte Fundstücke", { exact: true }).fill("3");
  await page.getByLabel("Demo-Budget pro Lauf (€)", { exact: true }).fill("0");
  type Run = {
    status: string;
    count: number;
    profile: { budget: number; count: number };
  };
  await expect
    .poll(
      async () =>
        (await localValue<Run[]>(page, researchKey("runs")))[0].status,
    )
    .toBe("completed");
  const run = (await localValue<Run[]>(page, researchKey("runs")))[0];
  expect(run.count).toBe(1);
  expect(run.profile).toMatchObject({ budget: 1, count: 1 });
  await page
    .getByLabel("Aktiver Account", { exact: true })
    .selectOption("acc-linkedin");
  await page.getByRole("tab", { name: "Rechercheprofil", exact: true }).click();
  await expect(
    page.getByLabel("Demo-Budget pro Lauf (€)", { exact: true }),
  ).toHaveValue("2");
  await page
    .getByLabel("Aktiver Account", { exact: true })
    .selectOption("acc-x");
  await page.getByRole("tab", { name: "Rechercheprofil", exact: true }).click();
  await expect(
    page.getByLabel("Demo-Budget pro Lauf (€)", { exact: true }),
  ).toHaveValue("0");
});

test("agent simulation can stop and resume and creates an unapproved draft for its account", async ({
  page,
}) => {
  await page.goto("/agent");
  await page
    .getByLabel("Account", { exact: true })
    .selectOption("acc-linkedin");
  await page
    .getByLabel("Nachricht an Agent", { exact: true })
    .fill("Hilf mir, ein konkretes Produkt-Learning zu erzählen.");
  await page.getByRole("button", { name: "Senden", exact: true }).click();
  await page.getByRole("button", { name: "Anhalten", exact: true }).click();
  await expect(page.getByText("Angehalten", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Antwort fortsetzen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Entwurf erstellen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/drafts\/draft-/);
  const url = page.url();
  const result = await stateOf(page);
  expect(result.drafts[0].accountId).toBe("acc-linkedin");
  expect(result.drafts[0].approval).toBeUndefined();
  expect(result.drafts[0].source).toContain("Agent · Unterhaltung");
  const conversation = (
    await localValue<
      { accountId: string; status: string; messages: { role: string }[] }[]
    >(page, "dispatch-ws-studio-agent-conversations")
  )[0];
  expect(conversation.accountId).toBe("acc-linkedin");
  expect(conversation.status).toBe("completed");
  expect(
    conversation.messages.filter((m) => m.role === "assistant"),
  ).toHaveLength(1);
  await page.goto("/agent");
  await page
    .getByLabel("Account", { exact: true })
    .selectOption("acc-linkedin");
  await page
    .getByRole("button", { name: "Entwurf öffnen", exact: true })
    .click();
  await expect(page).toHaveURL(url);
  expect((await stateOf(page)).drafts).toHaveLength(result.drafts.length);
});

test("analytics filters distinguish unknown metrics and keep channel baselines separate", async ({
  page,
}) => {
  await page.goto("/analytics");
  await page.getByLabel("Zeitraum", { exact: true }).selectOption("7");
  await expect(page.getByText("4.490", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Account", { exact: true }).selectOption("acc-bluesky");
  await expect(
    page.getByRole("heading", { name: "Noch keine Messwerte", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Beiträge", exact: true }).click();
  const unknownRows = page.locator("tbody tr");
  await expect(unknownRows).toHaveCount(2);
  await expect(unknownRows.first().locator("td").nth(2)).toHaveText("—");
  await expect(unknownRows.first().locator("td").nth(3)).toHaveText("—");
  await page.getByRole("tab", { name: "Überblick", exact: true }).click();
  await page.getByLabel("Account", { exact: true }).selectOption("all");
  await expect(page.getByText("Je Account", { exact: true })).toHaveCount(4);
  await expect(
    page.getByText(
      "Jeder Account hat seine eigene Baseline. Kanäle werden nicht zusammengeführt.",
    ),
  ).toBeVisible();
  await page.getByLabel("Kanal", { exact: true }).selectOption("LinkedIn");
  await expect(page.getByText("6.286", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Je Account", { exact: true })).toHaveCount(0);
});

test("historical analytics import pauses, resumes and deduplicates its example records", async ({
  page,
}) => {
  await page.goto("/analytics");
  await page.getByRole("tab", { name: "Datenverwaltung", exact: true }).click();
  await page
    .getByRole("button", { name: "Import starten", exact: true })
    .click();
  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  await expect(page.getByText("Pausiert", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fortsetzen", exact: true }).click();
  await expect(
    page.getByText("Import abgeschlossen", { exact: true }),
  ).toBeVisible();
  const key = "dispatch-ws-studio-analytics-metrics";
  type Metric = { id: string; origin: string };
  const first = await localValue<Metric[]>(page, key);
  expect(
    first.filter((m) => m.origin === "Historischer Demo-Import"),
  ).toHaveLength(2);
  await page
    .getByRole("button", { name: "Import starten", exact: true })
    .click();
  await expect(
    page.getByText("Import abgeschlossen", { exact: true }),
  ).toBeVisible();
  expect(await localValue<Metric[]>(page, key)).toHaveLength(first.length);
});

test("media validates local uploads, saves Alttext and removes only an unused asset", async ({
  page,
}) => {
  await page.goto("/media");
  const picker = page.locator("input[type=file]");
  await picker.setInputFiles({
    name: "not-a-media.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Not an image"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Bitte JPG" }),
  ).toBeVisible();
  await picker.setInputFiles({
    name: "regression-pixel.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD0kAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  const card = page
    .locator("article")
    .filter({ hasText: "regression-pixel.png" });
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Alttext fehlt. Vor Verwendung bitte ergänzen."),
  ).toBeVisible();
  await card
    .getByRole("button", { name: "Alttext bearbeiten", exact: true })
    .click();
  await page
    .getByLabel("Alternativtext", { exact: true })
    .fill("Ein einzelnes helles Pixel als lokale Testgrafik.");
  await page
    .getByRole("button", { name: "Alttext speichern", exact: true })
    .click();
  await expect(
    card.getByText("Ein einzelnes helles Pixel als lokale Testgrafik."),
  ).toBeVisible();
  const asset = (await stateOf(page)).media.find(
    (m) => m.name === "regression-pixel.png",
  )!;
  expect(asset.url).toMatch(/^data:image\/png;base64,/);
  await page.reload();
  await expect(
    card.getByText("Ein einzelnes helles Pixel als lokale Testgrafik."),
  ).toBeVisible();
  await card.getByRole("button", { name: "Entfernen", exact: true }).click();
  await expect(card).toHaveCount(0);
  expect((await stateOf(page)).media.some((m) => m.id === asset.id)).toBe(
    false,
  );
});

test("referenced media Alttext creates a new draft version and preserves the scheduled original", async ({
  page,
}) => {
  await page.goto("/media");
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    const draft = state.drafts.find((d: { id: string }) => d.id === "draft-2");
    draft.versions[0].mediaIds = ["media-1"];
    state.schedules.find((s: { id: string }) => s.id === "slot-1").mediaIds = [
      "media-1",
    ];
    localStorage.setItem(key, JSON.stringify(state));
  }, STORE_KEY);
  await page.reload();
  const original = (await stateOf(page)).media.find((m) => m.id === "media-1")!;
  const card = page.locator("article").filter({ hasText: "release-cover.svg" });
  await expect(
    card.getByRole("button", { name: "Entfernen", exact: true }),
  ).toBeDisabled();
  await card
    .getByRole("button", { name: "Alttext bearbeiten", exact: true })
    .click();
  await page
    .getByLabel("Alternativtext", { exact: true })
    .fill("Eine neue, geprüfte Beschreibung der Produktillustration.");
  await page
    .getByRole("button", { name: "Alttext speichern", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const result = await stateOf(page);
  const draft = result.drafts.find((d) => d.id === "draft-2")!;
  expect(draft.versions).toHaveLength(2);
  const version = draft.versions.at(-1)!;
  expect(version.mediaIds[0]).not.toBe("media-1");
  expect(draft.approval?.version).not.toBe(version.number);
  expect(result.media.find((m) => m.id === "media-1")?.alt).toBe(original.alt);
  expect(result.media.find((m) => m.id === version.mediaIds[0])?.alt).toBe(
    "Eine neue, geprüfte Beschreibung der Produktillustration.",
  );
  expect(result.schedules.find((s) => s.id === "slot-1")?.mediaIds).toEqual([
    "media-1",
  ]);
});

test("repurpose requires rights and separate review and preserves a channel draft handoff", async ({
  page,
}) => {
  await page.goto("/repurpose");
  await page
    .getByLabel("Dein Text", { exact: true })
    .fill("Mein eigener Text über bessere Produktentscheidungen.");
  await expect(
    page.getByRole("button", { name: "Demo-Auszüge vorbereiten", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Nutzungsrecht bestätigen", { exact: true }).check();
  await page
    .getByRole("button", { name: "Demo-Auszüge vorbereiten", exact: true })
    .click();
  const linkedin = page
    .locator("article")
    .filter({ hasText: "Matthias · Founder" });
  await expect(
    linkedin.getByRole("button", { name: "Entwurf erstellen", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("LinkedIn separat geprüft", { exact: true }).check();
  await linkedin
    .getByRole("button", { name: "Entwurf erstellen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/drafts\/draft-/);
  const url = page.url();
  const result = await stateOf(page);
  expect(result.drafts[0].accountId).toBe("acc-linkedin");
  expect(result.drafts[0].source).toContain(
    "Nutzungsrecht vom Nutzer bestätigt",
  );
  expect(result.drafts[0].approval).toBeUndefined();
  await page.goto("/repurpose");
  await expect(
    page.getByText("Inhaltliche Überlappung", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("LinkedIn separat geprüft", { exact: true }).check();
  await linkedin
    .getByRole("button", { name: "Entwurf öffnen", exact: true })
    .click();
  await expect(page).toHaveURL(url);
  expect((await stateOf(page)).drafts).toHaveLength(result.drafts.length);
});

test("experiments preserve their hypothesis, stop and resume with uncertainty in results", async ({
  page,
}) => {
  await page.goto("/experiments");
  await page
    .getByRole("button", { name: "Experiment anlegen", exact: true })
    .click();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Eine überprüfbare Produktfrage");
  await page
    .getByLabel("Hypothese", { exact: true })
    .fill(
      "Ein konkreter Einstieg führt zu mehr Antworten als ein allgemeiner Einstieg.",
    );
  await page
    .getByRole("button", { name: "Experiment speichern", exact: true })
    .click();
  const experiment = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Eine überprüfbare Produktfrage",
      exact: true,
    }),
  });
  await experiment
    .getByRole("button", { name: "Experiment starten", exact: true })
    .click();
  await experiment
    .getByRole("button", { name: "Demo-Ergebnisse ergänzen", exact: true })
    .click();
  await expect(
    experiment.getByText(/keine Signifikanzberechnung, kein Gewinner/),
  ).toBeVisible();
  await experiment
    .getByRole("button", { name: "Stoppen", exact: true })
    .click();
  await expect(experiment.getByText("Gestoppt", { exact: true })).toBeVisible();
  await page.reload();
  await expect(experiment.getByText("Gestoppt", { exact: true })).toBeVisible();
  await experiment
    .getByRole("button", { name: "Fortsetzen", exact: true })
    .click();
  await expect(experiment.getByText("Läuft", { exact: true })).toBeVisible();
  const stored = (
    await localValue<
      { title: string; hypothesis: string; samples: number; status: string }[]
    >(page, "dispatch-ws-studio-experiments")
  ).find((e) => e.title === "Eine überprüfbare Produktfrage")!;
  expect(stored.samples).toBe(4);
  expect(stored.status).toBe("running");
  expect(stored.hypothesis).toContain("konkreter Einstieg");
});

test("trends applies its configured threshold and retains false-alarm context", async ({
  page,
}) => {
  await page.goto("/trends");
  await page
    .getByRole("button", { name: "Vergleich bearbeiten", exact: true })
    .click();
  await page.getByLabel("Demo-Signalschwelle (%)", { exact: true }).fill("40");
  await page
    .getByRole("button", { name: "Demo-Vergleich erstellen", exact: true })
    .click();
  await expect(
    page.getByText("Unter Signalschwelle", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Demo-Backtest anzeigen", exact: true })
    .click();
  await expect(
    page.getByText("3 von 5 Demo-Signalen waren Fehlalarme."),
  ).toBeVisible();
  await expect(
    page.getByText("n = 5 · hohe Unsicherheit", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Unter Signalschwelle", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("3 von 5 Demo-Signalen waren Fehlalarme."),
  ).toBeVisible();
});

test("viewer can inspect product modules while all primary mutations remain disabled", async ({
  page,
}) => {
  await page.goto("/research");
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.role = "Viewer";
    localStorage.setItem(key, JSON.stringify(state));
  }, STORE_KEY);
  await page.reload();
  const baseline = await stateOf(page);
  for (const [route, action] of [
    ["/research", "Demo-Recherche starten"],
    ["/agent", "Neue Unterhaltung"],
    ["/analytics", "Historie importieren"],
    ["/media", "Medien hochladen"],
    ["/experiments", "Experiment anlegen"],
    ["/repurpose", "Demo-Auszüge vorbereiten"],
    ["/trends", "Demo-Vergleich erstellen"],
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toBeDisabled();
  }
  expect((await stateOf(page)).drafts).toHaveLength(baseline.drafts.length);
  expect((await stateOf(page)).media).toHaveLength(baseline.media.length);
});
