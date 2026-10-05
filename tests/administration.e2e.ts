import { test, expect, type Page } from "@playwright/test";
import type { AppState } from "../src/lib/model";

const readState = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("dispatch-demo-v1")!) as AppState,
  );

async function readLocal<T>(page: Page, key: string): Promise<T> {
  return page.evaluate(
    (storageKey) => JSON.parse(localStorage.getItem(storageKey)!),
    key,
  );
}

test("new plan proposals inherit required reviews and approvals stay version/account bound", async ({
  page,
}) => {
  await page.goto("/team");
  await page
    .getByRole("checkbox", { name: "Redaktionelle Prüfung", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Marke & Tonalität", exact: true })
    .check();
  const before = await readState(page);
  expect(before.reviewPolicies?.["ws-studio"]).toEqual({
    editorial: true,
    brand: true,
  });
  expect(
    before.schedules.filter(
      (s) => s.workspaceId === "ws-studio" && s.status === "scheduled",
    ),
  ).toHaveLength(0);
  expect(before.schedules.some((s) => s.status === "partial")).toBe(true);
  expect(before.schedules.some((s) => s.status === "uncertain")).toBe(true);

  await page.goto("/plans");
  await page.getByRole("button", { name: "Demo-Vorschläge erstellen" }).click();
  await expect(
    page.getByRole("button", { name: "Version freigeben", exact: true }),
  ).toHaveCount(3);
  const proposals = (await readState(page)).drafts.filter(
    (d) => d.versions[0].reason === "Lokaler Planvorschlag",
  );
  expect(proposals).toHaveLength(3);
  for (const draft of proposals) {
    expect(draft.reviewPolicy).toEqual({ editorial: true, brand: true });
    expect(draft.approval).toBeUndefined();
  }
  await page
    .getByRole("button", { name: "Version freigeben", exact: true })
    .first()
    .click();
  await expect(
    page.getByText(
      "Erforderliche redaktionelle und Marken-Reviews fehlen für diese Version.",
    ),
  ).toBeVisible();
  expect(
    (await readState(page)).drafts.find((d) => d.id === proposals[0].id)
      ?.approval,
  ).toBeUndefined();

  await page.goto("/team");
  await page
    .getByRole("button", { name: new RegExp(`^${proposals[0].title}`) })
    .click();
  const approve = page.getByRole("button", { name: "Diese Version freigeben" });
  await expect(approve).toBeDisabled();
  await page
    .getByRole("button", { name: "Redaktionelle Prüfung bestätigen" })
    .click();
  await expect(approve).toBeDisabled();
  await page.getByRole("button", { name: "Markenprüfung bestätigen" }).click();
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(
    page.getByRole("button", { name: "Version 1 freigegeben" }),
  ).toBeVisible();
  const approvedDraft = (await readState(page)).drafts.find(
    (d) => d.id === proposals[0].id,
  )!;
  expect(approvedDraft.approval).toMatchObject({
    version: 1,
    accountId: proposals[0].accountId,
  });
  expect(approvedDraft.reviews).toHaveLength(2);
  expect(
    approvedDraft.reviews?.every(
      (r) => r.version === 1 && r.accountId === proposals[0].accountId,
    ),
  ).toBe(true);

  await page.goto(`/drafts/${proposals[0].id}`);
  await page
    .getByLabel("Text Beitrag 1")
    .fill("Eine neue, kurze Version braucht eine neue Prüfung.");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await page.goto("/team");
  await page
    .getByRole("button", { name: new RegExp(`^${proposals[0].title}`) })
    .click();
  await expect(
    page.getByRole("button", { name: "Diese Version freigeben" }),
  ).toBeDisabled();
  const edited = (await readState(page)).drafts.find(
    (d) => d.id === proposals[0].id,
  )!;
  expect(edited.versions.at(-1)?.number).toBe(2);
  expect(edited.approval?.version).not.toBe(2);
  expect(edited.reviews?.every((r) => r.version === 1)).toBe(true);
});

test("last Owner is protected and Viewer/Editor administrative restrictions persist across routes", async ({
  page,
}) => {
  await page.goto("/team");
  await page
    .getByRole("combobox", { name: "Rolle von Matthias" })
    .selectOption("Editor");
  await expect(
    page.getByRole("combobox", { name: "Rolle von Matthias" }),
  ).toHaveValue("Owner");
  expect((await readState(page)).role).toBe("Owner");

  await page
    .getByRole("combobox", { name: "Aktive Demo-Rolle" })
    .selectOption("Viewer");
  await expect(
    page.getByRole("button", { name: "Einladen", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByLabel("Verantwortlich", { exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Kommentar hinzufügen" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", { name: "Redaktionelle Prüfung", exact: true }),
  ).toBeDisabled();
  await page.goto("/settings/profile");
  await expect(page.getByLabel("Dein Name", { exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Änderungen speichern" }),
  ).toBeDisabled();

  await page.goto("/team");
  await page
    .getByRole("combobox", { name: "Aktive Demo-Rolle" })
    .selectOption("Editor");
  await expect(
    page.getByLabel("Verantwortlich", { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Kommentar zur aktuellen Version")
    .fill("Konkretes redaktionelles Feedback aus der Editor-Rolle.");
  await expect(
    page.getByRole("button", { name: "Kommentar hinzufügen" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Diese Version freigeben" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Einladen", exact: true }),
  ).toBeDisabled();
  await page.goto("/settings/integrations");
  await expect(
    page.getByRole("button", { name: "Demo-Account hinzufügen" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Trennen", exact: true }).first(),
  ).toBeDisabled();
  expect((await readState(page)).role).toBe("Editor");
});

test("strategy form edits do not mutate saved versions and undo survives reload", async ({
  page,
}) => {
  await page.goto("/settings/strategy");
  const field = page.getByLabel("Positionierung", { exact: true });
  const original = await field.inputValue();
  const savedBefore = await readLocal(page, "dispatch-ws-studio-strategy");
  await field.fill("Ein noch nicht gespeicherter Gedanke.");
  expect(await readLocal(page, "dispatch-ws-studio-strategy")).toEqual(
    savedBefore,
  );
  await page
    .getByRole("button", { name: "Letzte Änderung rückgängig" })
    .click();
  await expect(field).toHaveValue(original);

  await field.fill("Neue, bewusst gespeicherte Positionierung.");
  await page.getByRole("button", { name: "Version 2 speichern" }).click();
  await expect
    .poll(() => readLocal(page, "dispatch-ws-studio-strategy"))
    .toMatchObject({
      version: 2,
      positioning: "Neue, bewusst gespeicherte Positionierung.",
    });
  const history = await readLocal<{ positioning: string; version: number }[]>(
    page,
    "dispatch-ws-studio-strategy-history",
  );
  expect(history).toEqual([
    expect.objectContaining({ version: 1, positioning: original }),
  ]);
  await page
    .getByRole("button", { name: "Letzte Änderung rückgängig" })
    .click();
  await page.reload();
  await expect(field).toHaveValue(original);
  expect(await readLocal(page, "dispatch-ws-studio-strategy")).toMatchObject({
    version: 1,
    positioning: original,
  });
});

test("GitHub demo login grants neither repository access nor private-context consent", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "GitHub-Anmeldung simulieren" })
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(await readLocal(page, "dispatch-ws-studio-github")).toMatchObject({
    login: true,
    installed: false,
    privateConsent: false,
  });
  await page.goto("/settings/integrations");
  await expect(
    page.getByRole("switch", { name: "Privaten Kontext erlauben" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "App-Installation simulieren" })
    .click();
  await expect(
    page.getByRole("switch", { name: "Privaten Kontext erlauben" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("switch", { name: "Privaten Kontext erlauben" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "Privaten Kontext erlauben" }).check();
  await page.reload();
  expect(await readLocal(page, "dispatch-ws-studio-github")).toMatchObject({
    login: true,
    installed: true,
    privateConsent: true,
  });
  await page
    .getByRole("button", { name: "Repository-Zugriff widerrufen" })
    .click();
  expect(await readLocal(page, "dispatch-ws-studio-github")).toMatchObject({
    login: true,
    installed: false,
    monitors: [],
  });
  await expect(
    page.getByRole("switch", { name: "Privaten Kontext erlauben" }),
  ).toBeDisabled();
});

test("automation checks time/channel scope and account/global stops spare manual schedules", async ({
  page,
}) => {
  await page.goto("/settings/automation");
  await expect(
    page.getByRole("switch", { name: "Richtlinie aktivieren" }),
  ).not.toBeChecked();
  const manualBefore = (await readState(page)).schedules;
  await page.getByRole("switch", { name: "Richtlinie aktivieren" }).check();
  await page.getByLabel("Uhrzeit der Shadow-Prüfung (simuliert)").fill("21:00");
  await expect(
    page.getByRole("button", { name: "Shadow-Prüfung simulieren" }),
  ).toBeDisabled();
  await page.getByLabel("Uhrzeit der Shadow-Prüfung (simuliert)").fill("10:00");
  await page.getByLabel("Kanal", { exact: true }).selectOption("LinkedIn");
  await page.getByRole("button", { name: "Shadow-Prüfung simulieren" }).click();
  await page.getByLabel("Kanal", { exact: true }).selectOption("X");
  await page.getByRole("button", { name: "Shadow-Prüfung simulieren" }).click();
  type Candidate = { accountId: string; status: string; version: number };
  const candidates = await readLocal<Candidate[]>(
    page,
    "dispatch-ws-studio-automation-candidates",
  );
  expect(candidates.map((c) => c.accountId).sort()).toEqual([
    "acc-linkedin",
    "acc-x",
  ]);
  expect(candidates.every((c) => c.status === "offen")).toBe(true);
  await page
    .getByRole("button", { name: "Diesen Account stoppen" })
    .nth(1)
    .click();
  const stopped = await readLocal<Candidate[]>(
    page,
    "dispatch-ws-studio-automation-candidates",
  );
  expect(stopped.find((c) => c.accountId === "acc-linkedin")?.status).toBe(
    "gestoppt",
  );
  expect(stopped.find((c) => c.accountId === "acc-x")?.status).toBe("offen");
  await page.getByRole("switch", { name: "Globaler Stopp" }).check();
  await expect(
    page.getByRole("button", { name: "Shadow-Prüfung simulieren" }),
  ).toBeDisabled();
  expect(
    (
      await readLocal<Candidate[]>(
        page,
        "dispatch-ws-studio-automation-candidates",
      )
    ).every((c) => c.status === "gestoppt"),
  ).toBe(true);
  expect((await readState(page)).schedules).toEqual(manualBefore);

  await page.getByRole("button", { name: /Matthias Studio.*Owner/ }).click();
  await page.getByRole("menuitem", { name: "Lemonspace", exact: true }).click();
  await page.goto("/settings/automation");
  await expect(
    page.getByRole("switch", { name: "Globaler Stopp" }),
  ).not.toBeChecked();
  expect(await readLocal(page, "dispatch-ws-studio-automation")).toMatchObject({
    kill: true,
    enabled: false,
  });
  await page
    .getByRole("button", { name: "Neue Richtlinienversion speichern" })
    .click();
  expect(await readLocal(page, "dispatch-ws-client-automation")).toMatchObject({
    kill: false,
    enabled: false,
  });
  await expect(page.getByRole("button", { name: "Idee annehmen" })).toHaveCount(
    0,
  );
  expect(
    await readLocal(page, "dispatch-ws-client-automation-candidates"),
  ).toBeNull();
});

test("account deletion failure is retryable and preserves shared workspace contents after owner handoff", async ({
  page,
}) => {
  await page.goto("/team");
  await page.getByRole("button", { name: "Owner-Übergabe" }).click();
  await page.getByRole("button", { name: "Übergabe bestätigen" }).click();
  await expect(
    page.getByRole("combobox", { name: "Rolle von Lea" }),
  ).toHaveValue("Owner");
  const before = await readState(page);
  expect(before.role).toBe("Admin");
  await page.goto("/settings/data");
  await page.getByRole("button", { name: "Löschung vorbereiten" }).click();
  await page
    .getByLabel("Zur Bestätigung „KONTO LÖSCHEN“ eingeben")
    .fill("KONTO LÖSCHEN");
  await page
    .getByRole("checkbox", { name: "Demo-Löschfehler einmal simulieren" })
    .check();
  await page.getByRole("button", { name: "Endgültig lokal löschen" }).click();
  await expect(page.getByText(/Simulierter Löschfehler/)).toBeVisible();
  expect(await readState(page)).toEqual(before);
  await page.getByRole("button", { name: "Löschung erneut versuchen" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.reload();
  const after = await readState(page);
  expect(after.preferences.name).toBe("");
  expect(after.workspaces).toEqual(before.workspaces);
  expect(after.accounts).toEqual(before.accounts);
  expect(after.drafts.map((d) => ({ id: d.id, versions: d.versions }))).toEqual(
    before.drafts.map((d) => ({ id: d.id, versions: d.versions })),
  );
  expect(
    after.schedules.map((s) => ({ id: s.id, text: s.text, status: s.status })),
  ).toEqual(
    before.schedules.map((s) => ({ id: s.id, text: s.text, status: s.status })),
  );
  const members = await readLocal<{ id: string; role: string }[]>(
    page,
    "dispatch-ws-studio-team-members",
  );
  expect(members.some((m) => m.id === "self")).toBe(false);
  expect(members.find((m) => m.id === "lea")?.role).toBe("Owner");
  expect(
    after.drafts
      .filter((d) => d.approval)
      .every((d) => d.approval?.by === "Ehemaliges Mitglied"),
  ).toBe(true);
});
