import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const output = "/tmp/dispatch-task47.2-evidence/browser-pixels";
mkdirSync(output, { recursive: true });
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const n=getFunctionName(ref);window.queries.push({n,args});if(n==='performance/experiments:list')return window.catalog;if(n==='performance/experiments:get')return window.detail;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({n:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const backendConfigured=true;export const AuthBoundary=({children})=>children;export const authClient={signOut:async()=>({})};export {authPath,returnPath} from '/src/lib/navigation.ts';`,
  "@/lib/store": `import {useState} from 'react';export const WorkspaceStoreProvider=({children})=>children;export const useLocalState=(k,i)=>useState(i);export const useWorkspaceLocalState=(k,i)=>{if(k==='experiments'&&!new URLSearchParams(location.search).get('demo'))throw Error('Native local experiment seed');return useState(i)};export const useStore=()=>({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,preferences:{timezone:'UTC',name:'Synthetic'},workspaces:[{id:window.workspace,name:'Synthetic Workspace'}],schedules:[],accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[]},setState:()=>{},selectWorkspace:async()=>true,selectAccount:()=>{},createDraft:()=>{throw Error('Live seed')},mutate:()=>{throw Error('Demo reached native')}});`,
};
const entry = `import {ConvexError} from 'convex/values';window.nativeConvexError=ConvexError;import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AppShell} from '/src/App.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import {ExperimentsPage} from '/src/pages/Explore.tsx';import '/src/index.css';window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.queries=[];window.commands=[];window.catalog={experiments:[],candidates:[{versionId:'version-one',number:1,draftId:'draft-one'},{versionId:'version-two',number:1,draftId:'draft-two'}],reviewers:[{reviewerId:'reviewer-one',role:'Owner'}]};window.detail=undefined;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{initialEntries:['/experiments']},React.createElement(TooltipProvider,null,React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(AppShell)},React.createElement(Route,{path:'experiments',element:React.createElement(ExperimentsPage)})))))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/experiments-fixture-vite`,
  server: { host: "127.0.0.1", port: 5176, strictPort: true },
  plugins: [
    {
      name: "experiments-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0experiment-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/experiments-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__experiment-entry"></script>',
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
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGEERROR", e.message);
  });
  await page.goto("http://127.0.0.1:5176/experiments-fixture");
  await expect(
    page.getByRole("heading", { name: "Experimente", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  const declare = page.getByRole("button", {
    name: "Experiment deklarieren",
    exact: true,
  });
  await declare.click();
  await expect(page.getByRole("alert")).toContainText("ausdrücklich");
  for (const [label, value] of [
    ["Hypothese", "Synthetic exact review hypothesis"],
    ["Variante A", "Question"],
    ["Variante B", "Observation"],
    ["Start (UTC, einschließlich)", "2026-10-07T08:00"],
    ["Ende (UTC, ausschließlich)", "2026-10-08T08:00"],
    ["Maximale Stichprobe (2–32)", "2"],
    ["Stop-Bedingung", "End of explicit window"],
    ["Tatsächlicher Kontext / Referenz", "Human reviewed source context"],
    ["Tatsächliche Frequenz / Referenz", "One review per exact unit"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Eine getestete Dimension", { exact: true })
    .selectOption("hook");
  await page
    .getByLabel("Beobachtetes Ergebnis", { exact: true })
    .selectOption("editorial-decision-v1");
  await page.getByLabel("Version 1 · version-one", { exact: true }).check();
  await page.getByLabel("Version 1 · version-two", { exact: true }).check();
  await page
    .getByLabel("Arm für version-two", { exact: true })
    .selectOption("B");
  for (const v of ["version-one", "version-two"])
    await page
      .getByLabel(`Prüfende Person für ${v}`, { exact: true })
      .selectOption("reviewer-one");
  await declare.click();
  await expect(page.getByLabel("Hypothese", { exact: true })).toBeDisabled();
  const original = await page.evaluate(() => window.commands[0].args);
  expect(original.action.units).toHaveLength(2);
  expect(original.expectedRevision).toBe(0);
  await page.evaluate(() => window.commands[0].reject(Error("lost response")));
  await expect(page.getByRole("alert")).toContainText("Derselbe Auftrag");
  await expect(page.getByLabel("Hypothese", { exact: true })).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Denselben Auftrag erneut senden",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(original);
  await page.evaluate(() => {
    window.catalog.experiments = [
      { experimentId: "experiment-one", revision: 1, state: "planned" },
    ];
    window.detail = {
      experimentId: "experiment-one",
      revision: 1,
      state: "planned",
      spec: window.commands[0].args.action.spec,
      sourceUntil: Date.now() + 600000,
      endsAt: Date.now() + 3600000,
      arms: {
        A: {
          enrolled: 1,
          decided: 0,
          accept: 0,
          reject: 0,
          conflict: 0,
          noFeedback: 1,
          withdrawn: 0,
          edited: 0,
          missingEdits: 0,
        },
        B: {
          enrolled: 1,
          decided: 0,
          accept: 0,
          reject: 0,
          conflict: 0,
          noFeedback: 1,
          withdrawn: 0,
          edited: 0,
          missingEdits: 0,
        },
      },
      counts: {
        enrolled: 2,
        decided: 0,
        accept: 0,
        reject: 0,
        conflict: 0,
        noFeedback: 2,
        withdrawn: 0,
        edited: 0,
        missingEdits: 0,
      },
      units: [
        {
          assignmentId: "assignment-one",
          versionId: "version-one",
          reviewerId: "reviewer-one",
          arm: "A",
          outcome: "no-feedback",
          editCount: 0,
          editExtent: null,
          missingEdits: 0,
          until: Date.now() + 600000,
        },
        {
          assignmentId: "assignment-two",
          versionId: "version-two",
          reviewerId: "reviewer-one",
          arm: "B",
          outcome: "no-feedback",
          editCount: 0,
          editExtent: null,
          missingEdits: 0,
          until: Date.now() + 600000,
        },
      ],
    };
    window.commands[1].resolve({
      experimentId: "experiment-one",
      revision: 1,
      receiptId: "receipt-one",
    });
    window.render();
  });
  await expect(
    page.getByText("Bearbeitungsbelege fehlen: 0", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Beobachtung starten", exact: true })
    .click();
  const start = await page.evaluate(() => window.commands[2].args);
  expect(start.experimentId).toBe("experiment-one");
  expect(start.expectedRevision).toBe(1);
  await page.evaluate(() => {
    window.detail.revision = 2;
    window.commands[2].reject(
      new window.nativeConvexError("EXPERIMENT_REVISION_CONFLICT"),
    );
    window.render();
  });
  await expect(page.getByRole("alert")).toContainText("REVISION_CONFLICT");
  await expect(
    page.getByRole("button", { name: "Beobachtung starten", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Aktuelle Revision prüfen und übernehmen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Beobachtung starten", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.commands[3].args.expectedRevision),
  ).toBe(2);
  expect(
    await page.evaluate(() => window.commands[3].args.commandKey),
  ).not.toBe(start.commandKey);
  await page.evaluate(() => {
    window.detail.state = "running";
    window.detail.revision = 3;
    window.detail.counts = {
      ...window.detail.counts,
      conflict: 1,
      noFeedback: 1,
      missingEdits: 1,
    };
    window.detail.arms.A = {
      ...window.detail.arms.A,
      conflict: 1,
      noFeedback: 0,
      missingEdits: 1,
    };
    window.detail.units[0].outcome = "conflict";
    window.detail.units[0].missingEdits = 1;
    window.commands[3].resolve({
      experimentId: "experiment-one",
      revision: 3,
      receiptId: "receipt-three",
    });
    window.render();
  });
  await expect(page.getByText("Konflikte: 1", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Bearbeitungsbelege fehlen: 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Beobachtung stoppen", exact: true })
    .click();
  expect(await page.evaluate(() => window.commands[4].args.action.kind)).toBe(
    "stop",
  );
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(declare).toBeDisabled();
  await page.evaluate(() =>
    window.commands[4].resolve({
      experimentId: "late-role",
      revision: 4,
      receiptId: "late",
    }),
  );
  await expect(
    page.getByText("Auftrag bestätigt.", { exact: false }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await expect(declare).toBeEnabled();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${output}/experiments-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .getByRole("heading", { name: "Experimente", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${output}/experiments-mobile.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByText("Konflikte: 1", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${output}/experiments-mobile-results.png`,
    fullPage: false,
  });

  await page.evaluate(() => {
    window.detail.sourceUntil = Date.now() + 100;
    window.detail.units[0].until = Date.now() + 100;
    window.render();
  });
  await expect(
    page.getByText("Quellenbeleg zurückgezogen oder abgelaufen.", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 4000 });
  await expect(page.getByText("Konflikte: 1", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Beobachtung starten", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.detail = undefined;
    window.catalog.experiments = [];
    window.account = "account-two";
    window.render();
  });
  await expect(page.getByLabel("Hypothese", { exact: true })).toHaveValue("");
  expect(await page.evaluate(() => window.queries.at(-1).args.accountId)).toBe(
    "account-two",
  );
  await declare.click();
  await expect(page.getByRole("alert")).toContainText("ausdrücklich");
  await page.reload();
  await page.evaluate(() => {
    window.catalog = undefined;
    window.render();
  });
  await expect(
    page.getByText("Experimente werden geladen.", { exact: true }),
  ).toBeVisible();
  await expect(declare).toBeDisabled();
  await page.reload();
  await page.evaluate(() => {
    const NativeDate = Date;
    window.__publicationNow = NativeDate.parse("2026-10-07T07:59:00Z");
    window.Date = class extends NativeDate {
      constructor(...args) {
        if (args.length) super(...args);
        else super(window.__publicationNow);
      }
      static now() {
        return window.__publicationNow;
      }
    };
    window.render();
  });
  await page
    .getByLabel("Beobachtetes Ergebnis", { exact: true })
    .selectOption("publication-count-v1");
  await expect(
    page.getByText("Messkonfiguration und unabhängige Nutzungsrechte fehlen.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  await page.evaluate(() => {
    window.catalog.publicationConfiguration = {
      policyId: "policy-one",
      policyFingerprint: "synthetic-native-fingerprint",
      version: "publication-test-v1",
      dialect: "post-fields-repost-v2",
      windows: [0.25],
      fields: ["likes"],
      expiresAt: Date.now() + 3600000,
    };
    window.catalog.schedules = [
      {
        scheduleId: "schedule-one",
        versionId: "version-one",
        at: Date.now() + 60000,
        positions: 3,
      },
      {
        scheduleId: "schedule-two",
        versionId: "version-two",
        at: Date.now() + 120000,
        positions: 3,
      },
    ];
    window.render();
  });
  for (const [label, value] of [
    ["Hypothese", "Synthetic prospective publication counts"],
    ["Variante A", "Question"],
    ["Variante B", "Observation"],
    ["Start (UTC, einschließlich)", "2026-10-07T08:00"],
    ["Ende (UTC, ausschließlich)", "2026-10-08T08:00"],
    ["Maximale Stichprobe (2–32)", "2"],
    ["Stop-Bedingung", "End of declared observation"],
    [
      "Tatsächlicher Kontext / Referenz",
      "Human controlled prospective publication context",
    ],
    ["Tatsächliche Frequenz / Referenz", "Two existing approved appointments"],
    [
      "Eigener Beleg für Experiment-Nutzungsrechte",
      "Explicit local synthetic experiment rights",
    ],
    [
      "Erklärung und Umfang der Experiment-Nutzung",
      "Compare exact prospective count definitions in this account",
    ],
    ["Ende der Experiment-Nutzungsrechte (UTC)", "2026-10-08T08:00"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Eine getestete Dimension", { exact: true })
    .selectOption("hook");
  await page
    .getByLabel("Exakter Zählwert", { exact: true })
    .selectOption("likes");
  await page
    .getByLabel("Messalter (Stunden)", { exact: true })
    .selectOption("0.25");
  await page.getByLabel(/^Termin schedule-one /).check();
  await page.getByLabel(/^Termin schedule-two /).check();
  await page
    .getByLabel("Arm für Termin schedule-two", { exact: true })
    .selectOption("B");
  await declare.click();
  const publicationCommand = await page.evaluate(() => window.commands[0].args);
  expect(publicationCommand.action.kind).toBe("declarePublication");
  expect(publicationCommand.action.units).toEqual([
    { scheduleId: "schedule-one", arm: "A", planItemId: null },
    { scheduleId: "schedule-two", arm: "B", planItemId: null },
  ]);
  expect(publicationCommand.action.spec.publication.windowHours).toBe(0.25);
  expect(publicationCommand.action.spec.publication.policyFingerprint).toBe(
    "synthetic-native-fingerprint",
  );
  await page.evaluate(() =>
    window.commands[0].reject(Error("publication response unknown")),
  );
  await page
    .getByRole("button", {
      name: "Denselben Auftrag erneut senden",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(
    publicationCommand,
  );
  await page.evaluate(() => {
    window.__publicationNow = Date.parse("2026-10-07T08:30:00Z");
    const empty = {
      assigned: 0,
      confirmed: 0,
      measured: 0,
      partial: 0,
      unknown: 0,
      excluded: 0,
      withdrawn: 0,
      missing: 0,
    };
    const until = Date.now() + 600000;
    window.catalog.experiments = [
      { experimentId: "publication-one", revision: 2, state: "running" },
    ];
    window.detail = {
      experimentId: "publication-one",
      revision: 2,
      state: "running",
      spec: window.commands[0].args.action.spec,
      sourceUntil: until,
      endsAt: Date.now() + 3600000,
      enrollmentCapped: true,
      counts: {
        enrolled: 2,
        decided: 0,
        accept: 0,
        reject: 0,
        conflict: 0,
        noFeedback: 2,
        withdrawn: 0,
        edited: 0,
        missingEdits: 0,
      },
      arms: {
        A: {
          enrolled: 1,
          decided: 0,
          accept: 0,
          reject: 0,
          conflict: 0,
          noFeedback: 1,
          withdrawn: 0,
          edited: 0,
          missingEdits: 0,
        },
        B: {
          enrolled: 1,
          decided: 0,
          accept: 0,
          reject: 0,
          conflict: 0,
          noFeedback: 1,
          withdrawn: 0,
          edited: 0,
          missingEdits: 0,
        },
      },
      units: [
        {
          assignmentId: "publication-assignment-one",
          versionId: "version-one",
          reviewerId: "reviewer-one",
          arm: "A",
          outcome: "no-feedback",
          editCount: 0,
          editExtent: null,
          missingEdits: 0,
          until,
        },
        {
          assignmentId: "publication-assignment-two",
          versionId: "version-two",
          reviewerId: "reviewer-one",
          arm: "B",
          outcome: "no-feedback",
          editCount: 0,
          editExtent: null,
          missingEdits: 0,
          until,
        },
      ],
      publication: {
        counts: { ...empty, assigned: 2, confirmed: 2, measured: 2 },
        arms: {
          A: { ...empty, assigned: 1, confirmed: 1, measured: 1 },
          B: { ...empty, assigned: 1, confirmed: 1, measured: 1 },
        },
        units: [
          {
            assignmentId: "publication-assignment-one",
            scheduleId: "schedule-one",
            arm: "A",
            outcome: "measured",
            reason: null,
            value: 0,
            firstSendAt: Date.now() - 1000000,
            until,
          },
          {
            assignmentId: "publication-assignment-two",
            scheduleId: "schedule-two",
            arm: "B",
            outcome: "measured",
            reason: null,
            value: 3,
            firstSendAt: Date.now() - 950000,
            until,
          },
        ],
        cohorts: [
          {
            key: "same-exact-thread-definition",
            format: "thread",
            media: "none",
            metric: "likes",
            rawField: "public_metrics.like_count",
            definition: "Public like count",
            definitionVersion: "publication-test-v1",
            dialect: "post-fields-repost-v2",
            windowHours: 0.25,
            A: {
              n: 1,
              sum: 0,
              mean: 0,
              from: Date.now() - 1000000,
              to: Date.now() - 1000000,
            },
            B: {
              n: 1,
              sum: 3,
              mean: 3,
              from: Date.now() - 950000,
              to: Date.now() - 950000,
            },
            difference: 3,
          },
        ],
      },
    };
    window.commands[1].resolve({
      experimentId: "publication-one",
      revision: 2,
      receiptId: "publication-receipt",
    });
    window.render();
  });
  await expect(
    page.getByText("Beobachtete Mittelwertdifferenz B − A: 3", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Arm A: n=1 · Summe 0", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: `${output}/publication-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByText("Beobachtete Mittelwertdifferenz B − A: 3", { exact: true })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `${output}/publication-mobile-results.png`,
    fullPage: false,
  });
  await page.evaluate(() => {
    window.detail.publication.counts = {
      assigned: 2,
      confirmed: 1,
      measured: 0,
      partial: 1,
      unknown: 0,
      excluded: 0,
      withdrawn: 0,
      missing: 0,
    };
    window.detail.publication.arms.A = {
      assigned: 1,
      confirmed: 1,
      measured: 0,
      partial: 0,
      unknown: 0,
      excluded: 0,
      withdrawn: 0,
      missing: 0,
    };
    window.detail.publication.arms.B = {
      assigned: 1,
      confirmed: 0,
      measured: 0,
      partial: 1,
      unknown: 0,
      excluded: 0,
      withdrawn: 0,
      missing: 0,
    };
    window.detail.publication.cohorts = [];
    window.detail.publication.units[0] = {
      ...window.detail.publication.units[0],
      outcome: "confirmed",
      reason: "missing",
      value: null,
    };
    window.detail.publication.units[1] = {
      ...window.detail.publication.units[1],
      outcome: "partial",
      reason: "incomplete-thread",
      value: null,
    };
    window.render();
  });
  await expect(
    page.getByText("Kein vollständiges vergleichbares Messpaar verfügbar.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Beobachtete Mittelwertdifferenz B − A: 3", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Experiment-Nutzungsrechte zurückziehen",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.commands[2].args.action.kind)).toBe(
    "withdraw",
  );
  await page.evaluate(() => {
    window.account = "publication-account-two";
    window.detail = undefined;
    window.catalog = {
      experiments: [],
      candidates: [],
      reviewers: [],
      schedules: [],
      publicationConfiguration: null,
    };
    window.render();
  });
  await page.evaluate(() =>
    window.commands[2].resolve({
      experimentId: "late-publication-one",
      revision: 3,
      receiptId: "late-publication",
    }),
  );
  await expect(page.getByLabel("Hypothese", { exact: true })).toHaveValue("");
  await expect(
    page.getByText("Auftrag bestätigt.", { exact: false }),
  ).toHaveCount(0);
  await page.goto("http://127.0.0.1:5176/experiments-fixture?demo=1");
  await expect(
    page.getByText("Fragen, die ein Gespräch eröffnen", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.queries.length)).toBe(0);
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  expect(errors).toEqual([]);
  console.log(
    `PASS actual styled editorial and publication Experiments desktop/390, finite human intent, no mount commands, exact retry/CAS, conflicts/missingness, role/account fences, horizon mask, loading and Demo isolation. Synthetic auth/transport mechanics only. Screenshots ${output}`,
  );
} catch (error) {
  console.log("BROWSER FAILURE", error.message);
  if (browser) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    for (const page of pages) {
      console.log((await page.locator("body").innerText()).slice(0, 4000));
      await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    }
  }
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
