import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client": "export const demoMode=false;",
  "@/lib/store":
    "export const useStore=()=>({state:window.store});export const useWorkspaceLocalState=()=>{throw new Error('Demo hook invoked in actual Analytics');};",
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{window.queries.push({name:getFunctionName(ref),args});return useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>getFunctionName(ref)==='performance/snapshots:overview'?window.data:getFunctionName(ref)==='performance/history:overview'?window.ownHistory:window.feedback);};export const useMutation=ref=>async args=>{const name=getFunctionName(ref);window.mutations.push({name,args});if(name==='performance/capabilities:consent')window.update({...window.data,enabled:args.enabled,reason:args.enabled?null:'OWN_METRICS_PAUSED'});if(name==='performance/history:start')window.updateHistory({...window.ownHistory,jobs:[{id:'import-job',state:'queued',pages:0,imported:0,rejected:0,reason:null,canResume:false}]});if(name==='performance/history:manage')window.updateHistory({...window.ownHistory,jobs:window.ownHistory.jobs.map(j=>({...j,state:args.operation==='pause'?'paused':args.operation==='resume'?'queued':'cancelled',canResume:args.operation==='pause'}))});if(name==='performance/history:remove')window.updateHistory({...window.ownHistory,posts:[],jobs:[]});if(name==='performance/capabilities:remove')window.update({...window.data,enabled:false,posts:window.data.posts.map(p=>({...p,snapshots:[]}))});};`,
};
const entry = `import '/src/index.css';import React from 'react';import ReactDOM from 'react-dom/client';import {AnalyticsPage} from '/src/pages/Analytics.tsx';
window.listeners=new Set();window.queries=[];window.mutations=[];window.store={activeWorkspaceId:'workspace',role:'Owner',accounts:[{id:'account',workspaceId:'workspace',channel:'X',name:'Own X'}]};window.data={enabled:false,reason:'OWN_METRICS_CONFIGURATION_REQUIRED',posts:[]};window.feedback=[];window.ownHistory={policy:null,reason:'OWN_HISTORY_CONFIGURATION_REQUIRED',maxResults:null,jobs:[],posts:[]};window.updateHistory=data=>{window.ownHistory=data;window.listeners.forEach(cb=>cb());};window.update=data=>{window.data=data;window.listeners.forEach(cb=>cb());};ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AnalyticsPage));`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/own-metrics-fixture-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "own-metrics-fixture",
      enforce: "pre",
      resolveId(id) {
        for (const key of ["@/lib/store", "@/lib/auth-client"])
          if (id.startsWith(`${root}/src/lib/${key.split("/").at(-1)}`))
            return `\0fixture:${key}`;
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0own-metrics-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url !== "/own-metrics-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__own-metrics-entry"></script>',
            ),
          );
        });
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
    viewport: { width: 1280, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("http://127.0.0.1:5174/own-metrics-fixture");
  await expect(
    page.getByRole("heading", { name: "Analytics", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Erfassung aktivieren" }),
  ).toBeDisabled();
  await expect(page.getByText("Leserechte", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "X-Verbindung und Freigaben" }),
  ).toHaveAttribute("href", "/settings/integrations");
  await expect(page.getByText("Alle Kennzahlen sind Demo-Daten.")).toHaveCount(
    0,
  );
  await page.evaluate(() => {
    window.updateHistory({
      reason: null,
      policy: {
        id: "history-policy",
        fingerprint: "immutable-ack",
        unitMicros: 5000,
        currency: "USD",
        retentionMs: 3 * 86400000,
        expiresAt: Date.now() + 86400000,
      },
      maxResults: 100,
      jobs: [],
      posts: [
        {
          _id: "imported",
          externalId: "201",
          contentType: "reply",
          mediaType: "unknown",
          providerCreatedAt: Date.now() - 40 * 86400000,
          observedAt: Date.now(),
          sourceUntil: Date.now() + 1000,
          text: "Imported later context only",
          versionId: null,
          thenKnowledgeId: null,
        },
      ],
    });
    window.feedback = [
      {
        _id: "feedback",
        kind: "edit",
        versionId: "version",
        editExtent: 4,
        sourceUntil: Date.now() + 1000,
        sourceUnavailable: false,
      },
    ];
    window.update({
      enabled: true,
      reason: null,
      configuration: {
        id: "metrics-policy",
        fingerprint: "exact-windows-ack",
        windows: [0.25, 1, 6, 24, 48],
        unitMicros: 5000,
        currency: "USD",
      },
      posts: [
        {
          coverage: { confirmed: 1, total: 1 },
          scheduleId: "schedule",
          contentType: "post",
          mediaType: "none",
          postAttemptId: "attempt",
          externalId: "101",
          position: 0,
          confirmedAt: Date.now() - 86400000,
          versionId: "version",
          knowledge: {
            assessmentId: "assessment",
            capturedAt: Date.now() - 86400000,
            applicable: true,
            reason: null,
            assessment: {
              sourceUntil: Date.now() + 1000,
              provenance: {
                resolvedModel: "synthetic-model",
                requestedModel: "synthetic-model",
              },
              result: {
                questionVersion: "jev-post-analysis-v1",
                score: { formulaVersion: "dispatch-score-v1" },
              },
            },
          },
          snapshots: [
            {
              dueAt: Date.now(),
              requestedAt: Date.now(),
              late: false,
              definitionVersion: "policy-v1",
              dialect: "post-fields-repost-v2",
              expiresAt: Date.now() + 86400000,
              windowHours: 24,
              state: "observed",
              observedAt: Date.now(),
              providerCreatedAt: null,
              reason: null,
              fields: [
                {
                  name: "impressions",
                  status: "measured",
                  value: 0,
                  rawField: "public_metrics.impression_count",
                  definition: "Repeated appearances",
                },
                {
                  name: "url_clicks",
                  status: "missing",
                  value: null,
                  rawField: "non_public_metrics.url_link_clicks",
                  definition: "Eligible own post clicks",
                },
              ],
            },
          ],
        },
      ],
    });
  });
  await expect(
    page.getByText("synthetic-model", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("4 geänderte Codepoints", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("dd").first()).toContainText("0");
  await expect(page.locator("dd").nth(1)).toContainText("—");
  await expect(page.getByText("gemessen", { exact: true })).toBeVisible();
  await expect(page.getByText("fehlt", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "/tmp/task41-analytics-values.png",
    fullPage: true,
  });
  await expect(
    page.getByText("Freigegebener Preis je zurückgegebenem Beitrag:", {
      exact: false,
    }),
  ).toContainText("0.500000 USD pro Seite / 1.500000 USD pro Import");
  await expect(
    page.getByText("Imported later context only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("private Abfragefenster abgelaufen", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/task41-history-values.png",
    fullPage: true,
  });
  await page.clock.fastForward(1100);
  await expect(
    page.getByText("Imported later context only", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Kontextquelle nicht mehr verfügbar", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("synthetic-model", { exact: false })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("4 geänderte Codepoints", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Quellenkontext entfernt", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("dd").first()).toContainText("0");
  await page.screenshot({
    path: "/tmp/task41-analytics-expired.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Redaktionell ablehnen" }).click();
  await page.getByRole("button", { name: "Erfassung pausieren" }).click();
  await expect(
    page.getByRole("button", { name: "Erfassung aktivieren" }),
  ).toBeEnabled();
  await expect(
    page.getByText("Aktuell freigegebene Fenster:", { exact: false }),
  ).toContainText("Höchstens 5 Abrufe");
  await page.getByRole("button", { name: "Erfassung aktivieren" }).click();
  await page.getByRole("button", { name: "Messwerte löschen" }).click();
  await expect(page.locator("dd")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Eigenen Kontext importieren und zustimmen" })
    .click();
  await expect(page.getByText("Import queued", { exact: false })).toBeVisible();
  await page
    .getByRole("button", { name: "Import pausieren", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Import fortsetzen", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Import fortsetzen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import abbrechen", exact: true })
    .click();
  await expect(
    page.getByText("Import cancelled", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Historischen Kontext löschen", exact: true })
    .click();
  await expect(page.getByText("Post 201", { exact: true })).toHaveCount(0);
  const historyCalls = await page.evaluate(() =>
    window.mutations.filter((x) => x.name.startsWith("performance/history:")),
  );
  expect(historyCalls.map((x) => x.name)).toEqual([
    "performance/history:start",
    "performance/history:manage",
    "performance/history:manage",
    "performance/history:manage",
    "performance/history:remove",
  ]);
  expect(historyCalls[0].args).toEqual({
    workspaceId: "workspace",
    accountId: "account",
    policyId: "history-policy",
    policyFingerprint: "immutable-ack",
    purpose: "own-history-analytics-context-v1",
    consent: true,
  });
  const calls = await page.evaluate(() =>
    window.mutations.filter((x) => !x.name.startsWith("performance/history:")),
  );
  expect(calls).toEqual(
    expect.arrayContaining([
      {
        name: "content/feedback:decide",
        args: {
          workspaceId: "workspace",
          versionId: "version",
          kind: "reject",
        },
      },
      {
        name: "performance/capabilities:consent",
        args: {
          workspaceId: "workspace",
          accountId: "account",
          policyId: "metrics-policy",
          policyFingerprint: "exact-windows-ack",
          enabled: false,
        },
      },
      {
        name: "performance/capabilities:consent",
        args: {
          workspaceId: "workspace",
          accountId: "account",
          policyId: "metrics-policy",
          policyFingerprint: "exact-windows-ack",
          enabled: true,
        },
      },
      {
        name: "performance/capabilities:remove",
        args: { workspaceId: "workspace", accountId: "account" },
      },
    ]),
  );
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/task41-analytics.png", fullPage: true });
  console.log(
    "PASS TASK41 actual styled Analytics + own-history lifecycle/context/expiry with explicit mocked transport/auth/store: default-off configuration, own0/missing, nearest source expiry, independent feedback, pause/delete routing. Mocked transport/auth/store; no real provider/manual acceptance.",
  );
} finally {
  await browser?.close();
  await server.close();
}
