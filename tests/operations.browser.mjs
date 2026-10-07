import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const evidence =
  process.env.DISPATCH_HEALTH_EVIDENCE_DIR ??
  "/tmp/dispatch-31.1-browser-operations";
mkdirSync(evidence, { recursive: true });
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import React from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
const tick=()=>React.useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)},()=>window.tick);
const funcs=new Map();const invoke=ref=>{const name=getFunctionName(ref);if(!funcs.has(name))funcs.set(name,async args=>{window.commands.push({name,args});if(name==='users:bootstrap')return 'user-owner';throw new Error('No domain writes in health fixture');});return funcs.get(name)};
export const useMutation=invoke;export const useAction=invoke;export const useConvex=()=>({query:async()=>{throw new Error('No direct remote read expected')}});export const useConvexAuth=()=>{tick();return {isAuthenticated:true,isLoading:false}};
export const useQuery=(ref,args)=>{tick();if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='users:current')return window.snapshot;if(name==='team:list')return window.roster;if(name==='editorial:resources')return window.resources;if(name==='operations/health:get'){if(window.healthError)throw Error('PRIVATE_PROVIDER_ERROR');return window.healthByKey[args.refreshKey];}return undefined;};
export const usePaginatedQuery=()=>{tick();return {results:[],status:'Exhausted',loadMore(){}}};`,
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
    /router\.eu\.requesty\.ai|api\.x\.com|api\.github\.com|cloudflare/,
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
