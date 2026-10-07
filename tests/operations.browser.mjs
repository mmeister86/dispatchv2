import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const evidence =
  process.env.DISPATCH_HEALTH_EVIDENCE_DIR ??
  "/tmp/dispatch-31.1-browser-operations";
mkdirSync(evidence, { recursive: true });
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import React from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
const tick=()=>React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);
const funcs=new Map();const invoke=ref=>{const name=getFunctionName(ref);if(!funcs.has(name))funcs.set(name,async args=>{window.commands.push({name,args});if(name==='users:bootstrap')return 'user-owner';if(name==='preferences:saveNotifications')return new Promise((resolve,reject)=>window.preferenceSaves.push({args,sessionId:window.session.session.id,resolve,reject}));throw new Error('No domain writes in health fixture');});return funcs.get(name)};
export const useMutation=invoke;export const useAction=invoke;export const useConvex=()=>({query:(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});if(name!=='operations/export:self')throw new Error('Unexpected direct read');return new Promise((resolve,reject)=>window.exportRequests.push({args,resolve,reject}));}});export const useConvexAuth=()=>{tick();return {isAuthenticated:true,isLoading:false}};
export const useQuery=(ref,args)=>{tick();if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='users:current')return window.snapshot;if(name==='team:list')return window.roster;if(name==='editorial:resources')return window.resources;if(name==='preferences:notifications'){if(window.preferenceError)throw Error('PRIVATE_PROVIDER_ERROR');return window.preferenceByKey[args.requestKey];}if(name==='operations/pilot:get'){if(window.pilotError)throw Error('PRIVATE_PROVIDER_ERROR');return window.pilotByKey[args.refreshKey];}if(name==='operations/health:get'){if(window.healthError)throw Error('PRIVATE_PROVIDER_ERROR');return window.healthByKey[args.refreshKey];}return undefined;};
export const usePaginatedQuery=(ref,args)=>{tick();const name=getFunctionName(ref);window.queries.push({name,args});return {results:name==='editorial/notices:list'?window.notices:[],status:'Exhausted',loadMore(){}}};`,
  "@/lib/auth-client": `import React from 'react';export const demoMode=window.demo;export const backendConfigured=true;export const convexClientInstance=null;export const ConvexBetterAuthProvider=({children})=>children;export const AuthBoundary=({children})=>children;export {authPath,returnPath} from '/src/lib/navigation.ts';export const authClient={useSession:()=>{React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);return {data:window.session,isPending:false}},signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};`,
};
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${evidence}/vite-cache`,
  server: { host: "127.0.0.1", port: 5189, strictPort: true },
  plugins: [
    {
      name: "operations-native-transport",
      enforce: "pre",
      resolveId(id) {
        if (
          id === "./auth-client" ||
          id === "@/lib/auth-client" ||
          id.startsWith(`${root}/src/lib/auth-client`)
        )
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
    },
  ],
});
await server.listen();
let browser;
try {
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      (existsSync(chrome) ? chrome : undefined),
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    provider = [],
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(
    /router\.eu\.requesty\.ai|api\.x\.com|api\.github\.com|api\.resend\.com|cloudflare/,
    (route) => {
      provider.push(route.request().url());
      return route.abort();
    },
  );
  await page.addInitScript(() => {
    window.demo = new URLSearchParams(location.search).has("demo");
    window.tick = 0;
    window.listeners = new Set();
    window.update = (patch) => {
      Object.assign(window, patch);
      window.tick++;
      for (const fn of window.listeners) fn();
    };
    window.commands = [];
    window.exportRequests = [];
    window.preferenceSaves = [];
    window.preferenceStored = {
      revision: 0,
      email: false,
      inAppSummaries: false,
      weekly: false,
      research: false,
      timezone: "UTC",
      quiet: null,
    };
    window.preferenceByKey = {};
    window.publishPreferences = (patch = {}) => {
      const a = window.queries
        .filter((q) => q.name === "preferences:notifications")
        .at(-1)?.args;
      if (!a) throw Error("No mounted preference query");
      window.preferenceByKey[a.requestKey] = {
        authId: window.session.user.id,
        sessionId: window.session.session.id,
        workspaceId: a.workspaceId,
        requestKey: a.requestKey,
        settings: structuredClone(window.preferenceStored),
        ...patch,
      };
      window.update({});
    };
    window.urlRevocations = [];
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.urlRevocations.push(url);
      revoke(url);
    };
    window.storageWrites = [];
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      window.storageWrites.push(key);
      return setItem.call(this, key, value);
    };
    window.notices = [];
    window.queries = [];
    window.session = {
      user: {
        id: "auth-owner",
        email: "owner@example.test",
        emailVerified: true,
      },
      session: { id: "session-owner" },
    };
    window.snapshot = {
      state: "ready",
      authId: "auth-owner",
      userId: "user-owner",
      activeWorkspaceId: "workspace-native",
      workspaces: [
        {
          id: "workspace-native",
          name: "Native workspace",
          description: "",
          role: "Owner",
        },
      ],
      preferences: {
        name: "Native Owner",
        timezone: "Europe/Berlin",
        language: "Deutsch",
        audience: "",
        tone: "",
        topics: "",
        onboardingDone: true,
        onboardingStep: 3,
      },
    };
    window.roster = {
      revision: 0,
      authId: "auth-owner",
      sessionId: "session-owner",
      workspaceId: "workspace-native",
      actorRole: "Owner",
      members: [
        {
          membershipId: "member-owner",
          userId: "user-owner",
          name: "Native Owner",
          role: "Owner",
        },
      ],
      invitations: [],
      invitationsLimited: false,
    };
    window.resources = {
      accounts: [
        {
          _id: "account-native",
          _creationTime: 1,
          workspaceId: "workspace-native",
          provider: "X",
          providerIdentity: "native",
          name: "Native X",
          handle: "@native",
          connection: "connected",
          capability: {
            maxText: 280,
            maxThread: 10,
            maxMedia: 4,
            mediaTypes: [],
            publish: false,
          },
        },
      ],
      assets: [],
      members: [{ id: "user-owner", role: "Owner", name: "Native Owner" }],
      events: [],
      notifications: [],
      resourcesLimited: false,
    };
    window.pilotByKey = {};
    window.publishPilot = (patch = {}) => {
      const a = window.queries
        .filter((q) => q.name === "operations/pilot:get")
        .at(-1)?.args;
      if (!a) throw Error("No mounted pilot query");
      const until = Date.now() + 10000;
      window.pilotByKey[a.refreshKey] = {
        authId: window.session.user.id,
        sessionId: window.session.session.id,
        refreshKey: a.refreshKey,
        data: {
          accountId: a.accountId,
          observedAt: Date.now(),
          windowHours: 24,
          until,
          coverage: {
            partial: true,
            candidateLimit: 5,
            subset: "original_single_text_post",
            remainder: "unknown",
          },
          cohorts: [
            {
              key: "opaque-synthetic",
              dialect: "post-fields-repost-v2",
              unit: "post",
              media: "none",
              windowHours: 24,
              until,
              impressions: { n: 1, sum: 0, mean: 0 },
            },
          ],
        },
        ...patch,
      };
      window.update({});
    };
    window.healthByKey = {};
    window.publishHealth = (health) => {
      const current = window.queries
        .filter((q) => q.name === "operations/health:get")
        .at(-1);
      if (!current) throw Error("No mounted health query");
      window.healthByKey[current.args.refreshKey] = health;
      window.update({});
    };
  });
  await page.goto("http://127.0.0.1:5189/operations");
  await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
  await expect(
    page.getByText("Betriebsbelege werden geladen …", { exact: true }),
  ).toBeVisible();

  await page.clock.install({ time: new Date("2026-10-07T22:00:00Z") });
  const health = await page.evaluate(() => {
    const now = Date.now();
    const names = [
      "publishing",
      "github",
      "media",
      "research",
      "generation",
      "own_metrics",
      "own_history",
      "jev_analyzer",
      "intent_routing",
      "embedding",
      "output_verification",
    ];
    const base = (kind, id, state, accountId = null) => ({
      parent: { kind, id },
      state,
      accountId,
      code: null,
      recordedAt: now,
      deadline: null,
      leaseUntil: null,
      notBefore: null,
      proofUntil: null,
      overdue: false,
      localReceipt: null,
      outcomes: [],
      recovery: null,
      receiptCoverage: "not_evaluated",
      moreReceipts: null,
      receipts: [],
    });
    const publishing = {
      ...base("publishing", "schedule-health", "publishing", "account-native"),
      deadline: now - 1,
      overdue: true,
      recovery: { kind: "draft", id: "draft-health" },
    };
    const github = {
      ...base("github", "github-health", "unknown"),
      leaseUntil: now - 1,
      notBefore: now + 15000,
      localReceipt: true,
      recovery: { kind: "signals" },
    };
    const media = {
      ...base("media", "media-health", "deleting"),
      notBefore: now + 20000,
      recovery: { kind: "media" },
    };
    const research = {
      ...base("research", "research-health", "completed", "account-native"),
      outcomes: ["empty", "partial", "unknown"],
      recovery: { kind: "research", id: "profile-health" },
    };
    const generation = {
      ...base("generation", "generation-health", "stopped", "account-native"),
      receiptCoverage: "bounded",
      moreReceipts: true,
      receipts: [
        {
          attemptId: "unknown-health",
          owner: "generation",
          state: "unknown",
          currency: "USD",
          heldMicros: 8100,
          estimatedMicros: null,
          settledAt: null,
        },
        {
          attemptId: "zero-health",
          owner: "generation",
          state: "settled",
          currency: "EUR",
          heldMicros: 0,
          estimatedMicros: 0,
          settledAt: now,
        },
      ],
    };
    const rows = [publishing, github, media, research, generation];
    return {
      workspaceId: "workspace-native",
      accountId: null,
      authId: "auth-owner",
      sessionId: "session-owner",
      observedAt: now,
      validUntil: now + 30000,
      coverage: {
        kind: "bounded_receipt_sample",
        accountsLoaded: 3,
        moreEligibleAccounts: true,
        total: null,
        reasons: ["parent_cap", "child_cap", "family_not_implemented"],
      },
      families: names.map((family, i) => ({
        family,
        coverage: i < 5 ? "bounded" : "not_evaluated",
        sampledRows: i === 0 ? 2 : i < 5 ? 1 : 0,
        moreEligibleRows: i === 0 ? null : i < 5 ? false : null,
        total: null,
        configuration: "not_evaluated",
        remoteCheck: "not_performed",
        reason:
          i === 0
            ? "parent_cap"
            : i === 4
              ? "child_cap"
              : i < 5
                ? null
                : "family_not_implemented",
        rows:
          i === 0
            ? [
                publishing,
                {
                  ...base(
                    "publishing",
                    "stopped-send",
                    "cancelled",
                    "account-native",
                  ),
                  code: "attention",
                },
              ]
            : i < 5
              ? [rows[i]]
              : [],
      })),
    };
  });
  await page.evaluate((value) => window.publishHealth(value), health);
  await expect(page.getByTestId("native-health")).toBeVisible();
  await expect(
    page.getByText("2 erfasste Vorgänge · Umfang offen.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Offener Vorgang · Abgleich nötig", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Keine Ergebnisse · Teilweise beendet · Ergebnis ungeklärt",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Gebunden: 0,0081 USD", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Verbucht: 0 EUR", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Weitere Finanzbelege nicht angezeigt; kein Gesamtbetrag."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Vorhandenen Vorgang öffnen" }).first(),
  ).toHaveAttribute("href", "/drafts/draft-health");
  await expect(
    page.getByRole("button", {
      name: /Wiederholen|Demo-Wiederholung|Erneut senden/,
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.commands.filter((c) => c.name !== "users:bootstrap"),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: `${evidence}/cloud-1280.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("native-health")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${evidence}/cloud-390.png`, fullPage: false });
  await page
    .getByRole("region", { name: "Öffentliche Generierung", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${evidence}/cloud-receipts-390.png`,
    fullPage: false,
  });
  const key = await page.evaluate(
    () =>
      window.queries.filter((q) => q.name === "operations/health:get").at(-1)
        .args.refreshKey,
  );
  await page.clock.runFor(30001);
  await expect(
    page.getByText("Nachweis abgelaufen. Bitte aktualisieren."),
  ).toBeVisible();
  await expect(page.getByTestId("native-health")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Nachweis aktualisieren", exact: true })
    .click();
  await expect(page.getByText("Betriebsbelege werden geladen …")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/health:get").at(-1)
          .args.refreshKey,
    ),
  ).not.toBe(key);
  const fresh = {
    ...health,
    observedAt: health.observedAt + 30001,
    validUntil: health.validUntil + 30001,
  };
  await page.evaluate((value) => window.publishHealth(value), fresh);
  await expect(page.getByTestId("native-health")).toBeVisible();
  await page
    .getByRole("combobox", { name: /^Bereich/ })
    .selectOption("account-native");
  await expect(page.getByTestId("native-health")).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/health:get").at(-1)
          .args.accountId,
    ),
  ).toBe("account-native");
  await page.evaluate((value) => window.publishHealth(value), fresh);
  await expect(
    page.getByText(
      "Der Nachweis gehört nicht mehr zur aktuellen Auswahl. Bitte aktualisieren.",
    ),
  ).toBeVisible();
  await page.evaluate((value) => window.publishHealth(value), {
    ...fresh,
    accountId: "account-native",
  });
  await expect(page.getByTestId("native-health")).toBeVisible();
  // Authenticated Store remounts and unique read keys prevent observed session A→B→A reuse.
  await page.evaluate(() =>
    window.update({
      session: { ...window.session, session: { id: "session-other" } },
    }),
  );
  await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
  await expect(page.getByTestId("native-health")).toHaveCount(0);
  await page.evaluate(() =>
    window.update({
      session: { ...window.session, session: { id: "session-owner" } },
    }),
  );
  await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
  await expect(page.getByText("Betriebsbelege werden geladen …")).toBeVisible();
  await expect(page.getByTestId("native-health")).toHaveCount(0);
  await page.evaluate((value) => window.publishHealth(value), fresh);
  await expect(page.getByTestId("native-health")).toBeVisible();
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        workspaces: [{ ...window.snapshot.workspaces[0], role: "Viewer" }],
      },
    }),
  );
  await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
  await expect(
    page.getByText(
      "Diese Übersicht steht nur Ownern und Admins zur Verfügung.",
    ),
  ).toBeVisible();
  const viewerQueries = await page.evaluate(
    () =>
      window.queries.filter((q) => q.name === "operations/health:get").length,
  );
  await page.clock.runFor(1000);
  expect(
    await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "operations/health:get").length,
    ),
  ).toBe(viewerQueries);
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        workspaces: [{ ...window.snapshot.workspaces[0], role: "Owner" }],
      },
    }),
  );
  await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
  await page.evaluate(() => window.update({ healthError: true }));
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Betriebsbelege konnten nicht geladen werden" }),
  ).toBeVisible();
  await expect(page.getByTestId("native-health")).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toContain(
    "PRIVATE_PROVIDER_ERROR",
  );
  await page.evaluate(() => window.update({ healthError: false }));
  await page
    .getByRole("button", { name: "Nachweis aktualisieren", exact: true })
    .click();
  await page.evaluate((value) => window.publishHealth(value), {
    ...fresh,
    coverage: {
      ...fresh.coverage,
      reasons: ["read_budget", "family_not_implemented"],
    },
    families: fresh.families.map((f) =>
      f.family === "generation"
        ? {
            ...f,
            coverage: "not_evaluated",
            rows: [],
            sampledRows: 0,
            moreEligibleRows: null,
            reason: "read_budget",
          }
        : f,
    ),
  });
  await expect(
    page.getByText(
      "Leserahmen erreicht. Weitere Bereiche wurden nicht ausgewertet.",
    ),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Kalibrierungsreferenzen", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Referenz-Account", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("tab", { name: "Algorithmusprofile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Intelligence-Profile", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Account auswählen. Analyse, Audience Fit und Embeddings sind nicht verfügbar.",
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Systemzustand", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nachweis aktualisieren", exact: true }),
  ).toBeVisible();
  // TASK-33.1.1: actual mounted Cloud self-profile consumer.
  await page.goto("http://127.0.0.1:5189/settings/data");
  await expect(
    page.getByRole("button", {
      name: "Eigenes Profil als JSON herunterladen",
      exact: true,
    }),
  ).toBeVisible();
  const exportButton = page.getByRole("button", {
    name: "Eigenes Profil als JSON herunterladen",
    exact: true,
  });
  const resolveExport = (patch = {}, index = -1) =>
    page.evaluate(
      ({ patch, index }) => {
        const r = window.exportRequests.at(index);
        const data = {
          format: "dispatch-self-profile",
          version: 1,
          observedAt: 1800000000000,
          user: { id: "user-owner", createdAt: 1 },
          workspace: { id: r.args.workspaceId, name: "Native workspace" },
          membership: { role: window.snapshot.workspaces[0].role },
          profile: {
            ...window.snapshot.preferences,
            audience: "Eigenes Publikum 🧭",
          },
          coverage: {
            kind: "selected_workspace_self_profile",
            complete: true,
            included: [
              "app_user_context",
              "selected_workspace_context",
              "own_membership",
              "own_profile",
            ],
            unsupported: ["private_content_and_components"],
          },
        };
        r.resolve({
          requestKey: r.args.requestKey,
          authId: r.args.expectedAuthId,
          sessionId: window.session.session.id,
          data,
          ...patch,
        });
      },
      { patch, index },
    );
  expect(await page.evaluate(() => window.exportRequests.length)).toBe(0);
  await expect(page.getByText(/Dies ist ein Teil-Export/)).toBeVisible();
  const beforeEntropy = await page.evaluate(() => window.exportRequests.length);
  await page.evaluate(() => {
    window.realUUID = crypto.randomUUID.bind(crypto);
    crypto.randomUUID = () => {
      throw Error("PRIVATE_ENTROPY_ERROR");
    };
  });
  await exportButton.click();
  await expect(page.getByRole("alert")).toContainText(
    "Profil-Export konnte nicht erstellt werden",
  );
  await expect(exportButton).toBeEnabled();
  expect(await page.evaluate(() => window.exportRequests.length)).toBe(
    beforeEntropy,
  );
  await page.evaluate(() => {
    crypto.randomUUID = window.realUUID;
  });
  const exportedFiles = [];
  for (const role of ["Owner", "Admin", "Editor", "Viewer"]) {
    await page.evaluate(
      (role) =>
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: [{ ...window.snapshot.workspaces[0], role }],
          },
        }),
      role,
    );
    await exportButton.click();
    await expect(exportButton).toBeDisabled();
    const delivered = page.waitForEvent("download");
    await resolveExport();
    const download = await delivered;
    expect(download.suggestedFilename()).toBe("dispatch-self-profile.json");
    const data = JSON.parse(readFileSync(await download.path(), "utf8"));
    exportedFiles.push(data);
    expect(data.membership.role).toBe(role);
    expect(data.profile.audience).toBe("Eigenes Publikum 🧭");
    expect(Object.keys(data.workspace).sort()).toEqual(["id", "name"]);
    expect(JSON.stringify(data)).not.toMatch(
      /authId|sessionId|requestKey|token|ownerId|localStorage/,
    );
    expect(data.coverage.kind).toBe("selected_workspace_self_profile");
    await expect(exportButton).toBeEnabled();
    await page.clock.runFor(1001);
  }
  const keys = await page.evaluate(() =>
    window.exportRequests.map((r) => r.args.requestKey),
  );
  expect(new Set(keys).size).toBe(4);
  expect(keys.every((key) => key.length > 0 && key.length <= 64)).toBe(true);
  expect(await page.evaluate(() => window.urlRevocations.length)).toBe(4);
  expect(await page.evaluate(() => window.storageWrites)).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${evidence}/profile-export-1280.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidence}/profile-export-390.png`,
    fullPage: false,
  });
  const downloadEvents = [];
  page.on("download", (d) => downloadEvents.push(d.suggestedFilename()));
  for (const mismatch of [
    { sessionId: "foreign-native-session" },
    { authId: "foreign-native-user" },
    { requestKey: "wrong-response-key" },
  ]) {
    await exportButton.click();
    await resolveExport(mismatch);
    await expect(page.getByRole("alert")).toContainText(
      "Anmeldung oder Auswahl hat sich geändert",
    );
  }
  const revocationsBeforeFailure = await page.evaluate(
    () => window.urlRevocations.length,
  );
  await page.evaluate(() => {
    window.realAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {
      throw Error("PRIVATE_HANDOFF_FAILURE");
    };
  });
  await exportButton.click();
  await resolveExport();
  await expect(page.getByRole("alert")).toContainText(
    "Profil-Export konnte nicht erstellt werden",
  );
  expect(await page.evaluate(() => window.urlRevocations.length)).toBe(
    revocationsBeforeFailure + 1,
  );
  await expect(exportButton).toBeEnabled();
  await page.evaluate(() => {
    HTMLAnchorElement.prototype.click = window.realAnchorClick;
  });
  await exportButton.click();
  await page.evaluate(() =>
    window.exportRequests.at(-1).reject(Error("PRIVATE_EXPORT_FAILURE")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Profil-Export konnte nicht erstellt werden",
  );
  expect(await page.locator("main").innerText()).not.toContain(
    "PRIVATE_EXPORT_FAILURE",
  );
  await exportButton.click();
  const oldRole = await page.evaluate(() => window.exportRequests.length - 1);
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        workspaces: [{ ...window.snapshot.workspaces[0], role: "Admin" }],
      },
    }),
  );
  await expect(exportButton).toBeEnabled();
  await resolveExport({}, oldRole);
  // Actual observed session A→B→A and workspace A→B→A remounts reject outstanding old results/errors.
  await exportButton.click();
  const oldSession = await page.evaluate(
    () => window.exportRequests.length - 1,
  );
  await page.evaluate(() =>
    window.update({
      session: { ...window.session, session: { id: "session-other" } },
    }),
  );
  await expect(exportButton).toBeEnabled();
  await page.evaluate(() =>
    window.update({
      session: { ...window.session, session: { id: "session-owner" } },
    }),
  );
  await expect(exportButton).toBeEnabled();
  await resolveExport({}, oldSession);
  await exportButton.click();
  const oldWorkspace = await page.evaluate(
    () => window.exportRequests.length - 1,
  );
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        activeWorkspaceId: "workspace-other",
        workspaces: [
          { ...window.snapshot.workspaces[0], id: "workspace-other" },
        ],
      },
      roster: { ...window.roster, workspaceId: "workspace-other" },
    }),
  );
  await expect(exportButton).toBeEnabled();
  await page.evaluate(() =>
    window.update({
      snapshot: {
        ...window.snapshot,
        activeWorkspaceId: "workspace-native",
        workspaces: [
          { ...window.snapshot.workspaces[0], id: "workspace-native" },
        ],
      },
      roster: { ...window.roster, workspaceId: "workspace-native" },
    }),
  );
  await expect(exportButton).toBeEnabled();
  await page.evaluate(
    (index) =>
      window.exportRequests[index].reject(Error("PRIVATE_LATE_EXPORT_FAILURE")),
    oldWorkspace,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await exportButton.click();
  const unmounted = await page.evaluate(() => window.exportRequests.length - 1);
  await page.getByRole("link", { name: "Mein Profil", exact: true }).click();
  await resolveExport({}, unmounted);
  expect(downloadEvents).toEqual([]);
  const allExportKeys = await page.evaluate(() =>
    window.exportRequests.map((r) => r.args.requestKey),
  );
  expect(new Set(allExportKeys).size).toBe(allExportKeys.length);
  expect(
    await page.evaluate(() =>
      window.commands.filter((c) => c.name !== "users:bootstrap"),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => window.storageWrites)).toEqual([]);

  // TASK-32.3 supersedes only Cloud-all-disabled/no-own-setter controls.
  await page.goto("http://127.0.0.1:5189/settings/notifications");
  const options = [
    "In-App-Zusammenfassungen",
    "E-Mail-Zusammenfassungen",
    "Wöchentlicher Überblick",
    "Research-Zusammenfassungen",
    "Ruhezeiten",
  ];
  const reloadPreferences = page.getByRole("button", {
    name: "Änderungen verwerfen und neu laden",
    exact: true,
  });
  const savePreferences = page.getByRole("button", {
    name: "Benachrichtigungswünsche speichern",
    exact: true,
  });
  const resolvePreference = (patch = {}, index = -1) =>
    page.evaluate(
      ({ patch, index }) => {
        const r = window.preferenceSaves.at(index);
        window.preferenceStored = {
          ...r.args.settings,
          revision: r.args.expectedRevision + 1,
        };
        r.resolve({
          authId: r.args.expectedAuthId,
          sessionId: r.sessionId,
          workspaceId: r.args.workspaceId,
          requestKey: r.args.requestKey,
          settings: structuredClone(window.preferenceStored),
          ...patch,
        });
      },
      { patch, index },
    );
  await expect(
    page.getByText("Benachrichtigungswünsche werden geladen …", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(savePreferences).toHaveCount(0);
  await page.evaluate(() => window.publishPreferences());
  for (const name of options) {
    await expect(
      page.getByRole("switch", { name, exact: true }),
    ).toHaveAttribute("aria-checked", "false");
    await expect(page.getByRole("switch", { name, exact: true })).toBeEnabled();
  }
  await expect(
    page.getByText(
      "E-Mail und In-App-/Wochen-/Research-Zusammenfassungen sowie die Ausführung von Ruhezeiten sind noch nicht verfügbar. Speichern aktiviert keine Zustellung.",
    ),
  ).toBeVisible();
  for (const role of ["Owner", "Admin", "Editor", "Viewer"]) {
    await page.evaluate(
      (role) =>
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: [{ ...window.snapshot.workspaces[0], role }],
          },
        }),
      role,
    );
    await reloadPreferences.click();
    await expect(
      page.getByTestId("native-notification-preferences"),
    ).toHaveCount(0);
    await page.evaluate(() => window.publishPreferences());
    const email = page.getByRole("switch", {
      name: "E-Mail-Zusammenfassungen",
      exact: true,
    });
    const prior = await email.getAttribute("aria-checked");
    await email.click();
    await expect(savePreferences).toBeEnabled();
    await savePreferences.click();
    await expect(savePreferences).toBeDisabled();
    await resolvePreference();
    await expect(
      page.getByText(
        "Benachrichtigungswünsche gespeichert. Keine Zustellung aktiviert.",
        { exact: true },
      ),
    ).toBeVisible();
    // An old subscription must not roll back the just-acknowledged local revision.
    await expect(email).toHaveAttribute(
      "aria-checked",
      prior === "true" ? "false" : "true",
    );
    await reloadPreferences.click();
    await expect(
      page.getByTestId("native-notification-preferences"),
    ).toHaveCount(0);
    await page.evaluate(() => window.publishPreferences());
    await expect(email).toHaveAttribute(
      "aria-checked",
      prior === "true" ? "false" : "true",
    );
  }
  await page.getByRole("switch", { name: "Ruhezeiten", exact: true }).click();
  await page
    .getByRole("textbox", {
      name: "Zeitzone für Benachrichtigungswünsche",
      exact: true,
    })
    .fill("Europe/Berlin");
  await page.getByLabel("Ruhezeit ab", { exact: true }).fill("21:00");
  await page.getByLabel("Ruhezeit bis", { exact: true }).fill("07:30");
  await page.evaluate(() => {
    window.preferenceStored = {
      ...window.preferenceStored,
      revision: window.preferenceStored.revision + 1,
      timezone: "UTC",
    };
    window.publishPreferences();
  });
  await expect(
    page.getByRole("textbox", {
      name: "Zeitzone für Benachrichtigungswünsche",
      exact: true,
    }),
  ).toHaveValue("Europe/Berlin");
  await expect(
    page.getByText(
      "Gespeicherter Stand wurde zwischenzeitlich geändert. Deine Eingaben bleiben erhalten.",
      { exact: true },
    ),
  ).toBeVisible();
  await savePreferences.click();
  await page.evaluate(() =>
    window.preferenceSaves.at(-1).reject(
      Object.assign(Error("PRIVATE_CONFLICT"), {
        data: "NOTIFICATION_REVISION_CONFLICT",
      }),
    ),
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Gespeicherter Stand wurde geändert" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "Zeitzone für Benachrichtigungswünsche",
      exact: true,
    }),
  ).toHaveValue("Europe/Berlin");
  await reloadPreferences.click();
  await page.evaluate(() => window.publishPreferences());
  await expect(
    page.getByRole("textbox", {
      name: "Zeitzone für Benachrichtigungswünsche",
      exact: true,
    }),
  ).toHaveValue("UTC");
  // Strict awaited native wire correlation for every field; no saved claim on mismatch.
  for (const patch of [
    { authId: "foreign" },
    { sessionId: "foreign" },
    { workspaceId: "foreign" },
    { requestKey: "foreign" },
  ]) {
    await page
      .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
      .click();
    await savePreferences.click();
    await resolvePreference(patch);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Anmeldung oder Auswahl hat sich geändert" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Benachrichtigungswünsche gespeichert. Keine Zustellung aktiviert.",
        { exact: true },
      ),
    ).toHaveCount(0);
    await reloadPreferences.click();
    await page.evaluate(() => window.publishPreferences());
  }
  await page
    .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
    .click();
  const beforePreferenceEntropy = await page.evaluate(
    () => window.preferenceSaves.length,
  );
  await page.evaluate(() => {
    window.preferenceEntropy = crypto.randomUUID.bind(crypto);
    crypto.randomUUID = () => {
      throw Error("Synthetic entropy");
    };
  });
  await savePreferences.click();
  await expect(
    page.getByRole("alert").filter({
      hasText: "Benachrichtigungswünsche konnten nicht gespeichert werden",
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.preferenceSaves.length)).toBe(
    beforePreferenceEntropy,
  );
  await page.evaluate(() => {
    crypto.randomUUID = window.preferenceEntropy;
  });
  await savePreferences.click();
  await resolvePreference();
  await expect(
    page.getByText(
      "Benachrichtigungswünsche gespeichert. Keine Zustellung aktiviert.",
      { exact: true },
    ),
  ).toBeVisible();
  for (const patch of [
    { authId: "foreign" },
    { sessionId: "foreign" },
    { workspaceId: "foreign" },
    { requestKey: "foreign" },
  ]) {
    await page.evaluate((patch) => window.publishPreferences(patch), patch);
    await expect(
      page.getByText(
        "Die Einstellungen gehören nicht mehr zur aktuellen Anmeldung oder Auswahl. Bitte neu laden.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByTestId("native-notification-preferences"),
    ).toHaveCount(0);
    await page.evaluate(() => window.publishPreferences());
  }
  // Real Store observed scope changes discard old asynchronous completions.
  for (const field of ["session", "role", "account", "workspace"]) {
    await page
      .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
      .click();
    await savePreferences.click();
    const old = await page.evaluate(() => window.preferenceSaves.length - 1);
    await page.evaluate((field) => {
      if (field === "session")
        window.update({
          session: { ...window.session, session: { id: "session-other" } },
        });
      if (field === "role")
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: [{ ...window.snapshot.workspaces[0], role: "Owner" }],
          },
        });
      if (field === "workspace")
        window.update({
          snapshot: {
            ...window.snapshot,
            activeWorkspaceId: "workspace-other",
            workspaces: [
              ...window.snapshot.workspaces,
              {
                id: "workspace-other",
                name: "Other",
                description: "",
                role: "Owner",
              },
            ],
          },
        });
    }, field);
    if (field === "account")
      await page
        .getByRole("combobox", { name: "Aktiver Account", exact: true })
        .selectOption("account-native");
    await expect(
      page.getByTestId("native-notification-preferences"),
    ).toHaveCount(0);
    await page.evaluate((field) => {
      if (field === "session")
        window.update({
          session: { ...window.session, session: { id: "session-owner" } },
        });
      if (field === "role")
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: [{ ...window.snapshot.workspaces[0], role: "Viewer" }],
          },
        });
      if (field === "workspace")
        window.update({
          snapshot: {
            ...window.snapshot,
            activeWorkspaceId: "workspace-native",
            workspaces: window.snapshot.workspaces.filter(
              (w) => w.id === "workspace-native",
            ),
          },
        });
    }, field);
    if (field === "account")
      await page
        .getByRole("combobox", { name: "Aktiver Account", exact: true })
        .selectOption("");
    await expect(
      page.getByTestId("native-notification-preferences"),
    ).toHaveCount(0);
    await resolvePreference({}, old);
    await expect(
      page.getByText(
        "Benachrichtigungswünsche gespeichert. Keine Zustellung aktiviert.",
        { exact: true },
      ),
    ).toHaveCount(0);
    await page.evaluate(() => window.publishPreferences());
  }
  await page
    .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
    .click();
  await savePreferences.click();
  const latePreference = await page.evaluate(
    () => window.preferenceSaves.length - 1,
  );
  await reloadPreferences.click();
  await page.evaluate(
    (latePreference) =>
      window.preferenceSaves[latePreference].reject(
        Error("PRIVATE_LATE_FAILURE"),
      ),
    latePreference,
  );
  await page.evaluate(() => window.publishPreferences());
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => window.update({ preferenceError: true }));
  await expect(
    page.getByRole("alert").filter({
      hasText: "Benachrichtigungswünsche konnten nicht geladen werden",
    }),
  ).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(
    "PRIVATE_PROVIDER_ERROR",
  );
  await page.evaluate(() => window.update({ preferenceError: false }));
  await reloadPreferences.click();
  await page.evaluate(() => window.publishPreferences());
  const saveKeys = await page.evaluate(() =>
    window.preferenceSaves.map((r) => r.args.requestKey),
  );
  expect(new Set(saveKeys).size).toBe(saveKeys.length);
  expect(
    await page.evaluate(() =>
      window.storageWrites.filter((key) => key.endsWith("-notifications")),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() =>
      window.commands.filter(
        (c) =>
          c.name !== "users:bootstrap" &&
          c.name !== "preferences:saveNotifications",
      ),
    ),
  ).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${evidence}/notifications-cloud-1280.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidence}/notifications-cloud-390.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.goto("http://127.0.0.1:5189/overview");
  await page.evaluate(() =>
    window.update({
      resources: {
        ...window.resources,
        notifications: [
          {
            _id: "transport-blocked",
            state: "blocked",
            errorCode: "PRIVATE_TRANSPORT_ERROR",
          },
        ],
      },
      notices: [
        {
          authId: "auth-owner",
          sessionId: "session-owner",
          id: "notice-owner",
          draftId: "draft-notice",
          versionId: "version-notice",
          accountId: "account-native",
          parent: { kind: "assignment", commandId: "assignment-notice" },
          createdAt: 1,
          sourceUntil: null,
          readAt: null,
          dismissedAt: null,
        },
      ],
    }),
  );
  const transport = page
    .getByRole("alert")
    .filter({ hasText: "Publishing-Benachrichtigung" });
  await expect(transport).toContainText(
    "Ob die Nachricht zugestellt wurde, ist damit nicht geklärt.",
  );
  expect(await transport.innerText()).not.toMatch(
    /konnte nicht zugestellt|Zustellung ist fehlgeschlagen|PRIVATE_TRANSPORT_ERROR/,
  );
  await expect(transport.getByRole("link")).toHaveAttribute(
    "href",
    "/settings/integrations",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${evidence}/transport-overview-1280.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidence}/transport-overview-390.png`,
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Benachrichtigungen öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dein Posteingang", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Entwurf zugewiesen", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entwurf prüfen", exact: true }),
  ).toHaveAttribute("href", "/drafts/draft-notice");
  await expect(
    page.getByRole("button", { name: "Als gelesen markieren", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    window.update({
      resources: {
        ...window.resources,
        notifications: [
          { _id: "transport-sent", state: "sent", errorCode: null },
        ],
      },
    }),
  );
  await expect(transport).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(
    /Zustellung bestätigt|Nachricht zugestellt|E-Mail gelesen/,
  );
  expect(
    await page.evaluate(() =>
      window.commands.filter((c) => c.name !== "users:bootstrap"),
    ),
  ).toEqual([]);
  // TASK-35.1: actual Cloud Pilot mount, current Store selection and transport correlation.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("http://127.0.0.1:5189/operations");
  await page
    .getByRole("tab", { name: "Pilot-Auswertung", exact: true })
    .click();
  await expect(
    page.getByText("Bitte einen Account auswählen.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.queries.filter((q) => q.name === "operations/pilot:get"),
    ),
  ).toEqual([]);
  await page
    .getByRole("combobox", { name: "Aktiver Account", exact: true })
    .selectOption("account-native");
  await expect(
    page.getByText("Messwerte werden geladen …", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.publishPilot());
  await expect(page.getByTestId("native-pilot")).toBeVisible();
  await expect(page.getByTestId("pilot-n")).toHaveText("1");
  await expect(page.getByTestId("pilot-sum")).toHaveText("0");
  await expect(page.getByTestId("pilot-mean")).toHaveText("0");
  expect(await page.locator("main").innerText()).toContain(
    "Der weitere Umfang ist unbekannt",
  );
  expect(await page.locator("main").innerText()).not.toMatch(
    /ROI|Stunden gespart|USD|EUR|opaque-synthetic|test-v1/,
  );
  await page.screenshot({
    path: `${evidence}/pilot-1280.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: `${evidence}/pilot-390.png`, fullPage: false });
  const oldPilotKey = await page.evaluate(
    () =>
      window.queries.filter((q) => q.name === "operations/pilot:get").at(-1)
        .args.refreshKey,
  );
  await page
    .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
    .click();
  await expect(page.getByTestId("native-pilot")).toHaveCount(0);
  const newPilotKey = await page.evaluate(
    () =>
      window.queries.filter((q) => q.name === "operations/pilot:get").at(-1)
        .args.refreshKey,
  );
  expect(newPilotKey).not.toBe(oldPilotKey);
  await page.evaluate(
    (key) => window.publishPilot({ refreshKey: key }),
    oldPilotKey,
  );
  await expect(
    page.getByText(
      "Der Messnachweis gehört nicht mehr zur aktuellen Auswahl. Bitte aktualisieren.",
    ),
  ).toBeVisible();
  await page.evaluate(() => {
    const a = window.queries
      .filter((q) => q.name === "operations/pilot:get")
      .at(-1).args;
    window.publishPilot();
    const value = window.pilotByKey[a.refreshKey];
    window.publishPilot({
      data: {
        ...value.data,
        cohorts: value.data.cohorts.map((c) => ({
          ...c,
          impressions: { n: 0, sum: null, mean: null },
        })),
      },
    });
  });
  await expect(page.getByTestId("pilot-n")).toHaveText("0");
  await expect(page.getByTestId("pilot-sum")).toHaveText("Unbekannt");
  await expect(page.getByTestId("pilot-mean")).toHaveText("Unbekannt");
  await page.evaluate(() => window.publishPilot());
  const readCount = await page.evaluate(
    () =>
      window.queries.filter((q) => q.name === "operations/pilot:get").length,
  );
  await page.clock.runFor(10001);
  await expect(
    page.getByText("Messnachweis abgelaufen. Bitte aktualisieren."),
  ).toBeVisible();
  await expect(page.getByTestId("native-pilot")).toHaveCount(0);
  // Clock expiry renders locally and keeps the existing subscription key.
  expect(
    await page.evaluate(
      (readCount) => [
        ...new Set(
          window.queries
            .filter((q) => q.name === "operations/pilot:get")
            .slice(readCount)
            .map((q) => q.args.refreshKey),
        ),
      ],
      readCount,
    ),
  ).toEqual([newPilotKey]);
  await page.evaluate(() => {
    window.savedPilotEntropy = crypto.randomUUID.bind(crypto);
    crypto.randomUUID = () => {
      throw Error("Synthetic entropy failure");
    };
  });
  await page
    .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Messwerte konnten nicht geladen werden" }),
  ).toBeVisible();
  await expect(page.getByTestId("native-pilot")).toHaveCount(0);
  await page.evaluate(() => {
    crypto.randomUUID = window.savedPilotEntropy;
  });
  await page
    .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
    .click();
  await page.evaluate(() => window.publishPilot());
  await expect(page.getByTestId("native-pilot")).toBeVisible();
  await page.evaluate(() =>
    window.update({
      resources: {
        ...window.resources,
        accounts: [
          ...window.resources.accounts,
          {
            ...window.resources.accounts[0],
            _id: "account-other",
            name: "Other X",
            handle: "@other",
          },
        ],
      },
    }),
  );
  await page
    .getByRole("combobox", { name: "Aktiver Account", exact: true })
    .selectOption("account-other");
  await expect(page.getByTestId("native-pilot")).toHaveCount(0);
  await page.evaluate(() =>
    window.publishPilot({
      data: {
        ...window.pilotByKey[Object.keys(window.pilotByKey)[0]].data,
        accountId: "account-native",
      },
    }),
  );
  await expect(
    page.getByText(
      "Der Messnachweis gehört nicht mehr zur aktuellen Auswahl. Bitte aktualisieren.",
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Aktiver Account", exact: true })
    .selectOption("account-native");
  await expect(page.getByTestId("native-pilot")).toHaveCount(0);
  for (const role of ["Editor", "Viewer", "Admin", "Owner"]) {
    await page.evaluate(
      (role) =>
        window.update({
          snapshot: {
            ...window.snapshot,
            workspaces: [{ ...window.snapshot.workspaces[0], role }],
          },
        }),
      role,
    );
    await page
      .getByRole("tab", { name: "Pilot-Auswertung", exact: true })
      .click();
    if (role === "Editor" || role === "Viewer") {
      await expect(
        page.getByText(
          "Diese Auswertung steht nur Ownern und Admins zur Verfügung.",
        ),
      ).toBeVisible();
      await expect(page.getByTestId("native-pilot")).toHaveCount(0);
    } else {
      await page
        .getByRole("combobox", { name: "Aktiver Account", exact: true })
        .selectOption("account-native");
      await expect(
        page.getByText("Messwerte werden geladen …", { exact: true }),
      ).toBeVisible();
      await expect(page.getByTestId("native-pilot")).toHaveCount(0);
      await page.evaluate(() => window.publishPilot());
      await expect(page.getByTestId("native-pilot")).toBeVisible();
    }
  }
  for (const id of ["session-other", "session-owner"]) {
    await page.evaluate(
      (id) =>
        window.update({ session: { ...window.session, session: { id } } }),
      id,
    );
    await page
      .getByRole("tab", { name: "Pilot-Auswertung", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Aktiver Account", exact: true })
      .selectOption("account-native");
    await expect(page.getByTestId("native-pilot")).toHaveCount(0);
  }
  await page.evaluate(() => window.update({ pilotError: true }));
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Messwerte konnten nicht geladen werden" }),
  ).toBeVisible();
  expect(await page.locator("main").innerText()).not.toContain(
    "PRIVATE_PROVIDER_ERROR",
  );
  await page.evaluate(() => window.update({ pilotError: false }));
  await page
    .getByRole("button", { name: "Messwerte aktualisieren", exact: true })
    .click();
  await page.evaluate(() => window.publishPilot());
  await expect(page.getByTestId("native-pilot")).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.commands.filter((c) => c.name !== "users:bootstrap"),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => window.storageWrites)).toEqual([]);

  await page.goto("http://127.0.0.1:5189/operations?demo=1");
  await expect(page.getByText("Lokale Demo", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Demo-Wiederholung", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Demo-Wiederholung", exact: true })
    .click();
  await expect(
    page.getByText("Wiederholung läuft", { exact: true }).last(),
  ).toBeVisible();
  await page.clock.runFor(651);
  await expect(
    page.getByText(
      "Lokale Demo-Wiederholung abgeschlossen. Kein Remote-Ereignis oder Beitrag ausgeführt.",
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.queries.filter((q) => q.name === "operations/health:get"),
    ),
  ).toEqual([]);
  await page.goto("http://127.0.0.1:5189/settings/data?demo=1");
  await expect(
    page.getByRole("button", { name: "Export vorbereiten", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Eigenes Profil als JSON herunterladen",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Export vorbereiten", exact: true })
    .click();
  await page.clock.runFor(501);
  const demoDownloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON herunterladen", exact: true })
    .click();
  const demoDownload = await demoDownloadEvent;
  expect(demoDownload.suggestedFilename()).toBe("dispatch-workspace.json");
  const demoData = JSON.parse(readFileSync(await demoDownload.path(), "utf8"));
  expect(demoData).toHaveProperty("drafts");
  expect(demoData).toHaveProperty("settings");
  expect(await page.evaluate(() => window.exportRequests.length)).toBe(0);
  await page.goto("http://127.0.0.1:5189/settings/notifications?demo=1");
  for (const [name, checked] of [
    ["In-App-Zusammenfassungen", true],
    ["E-Mail-Zusammenfassungen", false],
    ["Wöchentlicher Überblick", true],
    ["Research-Zusammenfassungen", true],
    ["Ruhezeiten", true],
  ]) {
    await expect(
      page.getByRole("switch", { name, exact: true }),
    ).toHaveAttribute("aria-checked", String(checked));
    await expect(page.getByRole("switch", { name, exact: true })).toBeEnabled();
  }
  await page
    .getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true })
    .click();
  await page.getByRole("switch", { name: "Ruhezeiten", exact: true }).click();
  const demoPrefs = await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((k) => k.endsWith("-notifications"))
      .map((k) => JSON.parse(localStorage.getItem(k))),
  );
  expect(demoPrefs).toEqual([
    {
      inApp: true,
      email: true,
      summaries: true,
      research: true,
      quiet: false,
      start: "20:00",
      end: "08:00",
    },
  ]);
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "E-Mail-Zusammenfassungen", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("switch", { name: "Ruhezeiten", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(page.getByLabel("Ab", { exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${evidence}/notifications-demo-1280.png`,
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${evidence}/notifications-demo-390.png`,
    fullPage: false,
  });
  await page.evaluate(async () => {
    const { createSeed } = await import("/src/lib/model.ts");
    localStorage.setItem(
      "dispatch-demo-v1",
      JSON.stringify({ ...createSeed(), role: "Viewer" }),
    );
  });
  await page.reload();
  for (const name of options)
    await expect(
      page.getByRole("switch", { name, exact: true }),
    ).toBeDisabled();
  expect(await page.evaluate(() => window.commands)).toEqual([]);
  expect(provider).toEqual([]);
  expect(errors.filter((e) => !e.includes("PRIVATE_PROVIDER_ERROR"))).toEqual(
    [],
  );
  writeFileSync(
    `${evidence}/receipt.json`,
    JSON.stringify(
      {
        actualApp: true,
        actualStore: true,
        productionCss: true,
        viewports: [1280, 390],
        scopeSessionABA: true,
        accountFence: true,
        clockExpiry: true,
        explicitRefresh: true,
        errorPrivacy: true,
        partialCoverage: true,
        existingTabs: true,
        isolatedDemoTimer: true,
        cloudNotificationDefaultOff: true,
        cloudNativePreferencesPersisted: true,
        cloudNotificationDirtyCASCorrelationABA: true,
        cloudNotificationDeliveryUnavailable: true,
        cloudNotificationRoles: ["Owner", "Admin", "Editor", "Viewer"],
        cloudNoAppLocalPreferenceStorage: true,
        cloudOnlyOwnPreferenceSetter: true,
        existingRecipientInbox: true,
        unresolvedTransportCopy: true,
        demoPreferencePersistenceAndViewer: true,
        nativeSelfProfileDownload: true,
        exportRoles: ["Owner", "Admin", "Editor", "Viewer"],
        exportFreshKeys: true,
        exportNativeCorrelationExcludedFromFiles: true,
        exportSessionWorkspaceABAAndLateUnmount: true,
        exportNoAppPersistence: true,
        exportEntropyFailureAndRetry: true,
        exportLocalHandoffFailureRevokesUrl: true,
        exportRoleLateResultRejected: true,
        exportFileCount: exportedFiles.length,
        nativePilot: {
          selectedAccountOnly: true,
          roles: ["Owner", "Admin"],
          zeroUnknown: true,
          refreshAndCorrelation: true,
          expiryWithoutNewKey: true,
          entropyFailureRetry: true,
          accountRoleSessionABA: true,
          safeError: true,
        },
        provider,
        errors,
        manualAccessibility: false,
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  await server.close();
}
