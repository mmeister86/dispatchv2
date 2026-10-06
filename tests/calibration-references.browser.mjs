import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const evidence = "/tmp/dispatch-task43.1-evidence/browser";
mkdirSync(evidence, { recursive: true });
const mocks = {
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});return useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>args==='skip'?undefined:window.results[name]);};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const backendConfigured=true;export const AuthBoundary=({children})=>children;export const authClient={signOut:async()=>({})};export {authPath,returnPath} from '/src/lib/navigation.ts';`,
  "@/lib/store": `import {useState,useSyncExternalStore} from 'react';import {demoMode} from '@/lib/auth-client';export const WorkspaceStoreProvider=({children})=>children;export const useLocalState=(k,i)=>useState(i);export const useWorkspaceLocalState=(k,i)=>{if(!demoMode&&k!=='notification-read')throw Error('Demo hook reached real Operations: '+k);return useState(i);};export const useStore=()=>({state:useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>window.store),setState:()=>{},selectWorkspace:async()=>true,selectAccount:()=>{},createDraft:()=>{throw Error('Demo draft');},mutate:()=>{throw Error('Demo mutation');}});`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AppShell} from '/src/App.tsx';import {OperationsPage} from '/src/pages/Operations.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import '/src/index.css';
window.listeners=new Set();window.commands=[];window.queries=[];window.store={activeWorkspaceId:'workspace',activeAccountId:'account',role:'Owner',preferences:{timezone:'UTC',name:'Synthetic'},workspaces:[{id:'workspace',name:'Synthetic Workspace'}],accounts:[{id:'account',workspaceId:'workspace',name:'Own X',channel:'X'},{id:'account2',workspaceId:'workspace',name:'Other X',channel:'X'}],drafts:[],schedules:[]};
const now=Date.now(),expiresAt=now+120000,proofUntil=now+20000;
window.empty={enabled:false,reason:'CALIBRATION_CONFIGURATION_REQUIRED',configuration:null,choices:[],choicesPartial:false,specs:[],snapshots:[],unavailable:[]};
window.configuration={id:'purpose-one',fingerprint:'exact-local-evidence-proof',version:'isolated-local-v1',rightsEvidence:'Synthetic separate local analysis and measured-outcome permission',explanation:'Local reply ordering only',expiresAt,retentionMs:86400000,withdrawn:false};
window.spec={_id:'spec-one',createdAt:now-120000,expiresAt:proofUntil,payload:{mode:'prospective',prospectiveStatus:'candidate-not-frozen',holdout2End:now+15*86400000,compatibility:{resolvedModel:'jev-1.13.0',questionVersion:'jev-post-analysis-v1',normalizationVersion:'jev-normalization-v1',formulaVersion:'dispatch-score-v1',metricVersion:'exact-metric-v1',dialect:'post-fields-repost-v2',algorithmId:'algorithm-one',audienceId:'audience-one'}}};
window.complete={enabled:true,reason:null,configuration:window.configuration,choices:[{postAttemptId:'attempt-one',assessmentId:'assessment-one',publishedAt:now-2*86400000,versionNumber:1,requestedModel:'jev-1.13.0',resolvedModel:'jev-1.13.0',expiresAt:proofUntil}],choicesPartial:false,specs:[window.spec],snapshots:[{row:{_id:'snapshot-one',expiresAt:proofUntil,payload:{asOf:now,counts:{n:1,train:1,block1:0,block2:0},frameComplete:true,scanned:2,populationTotal:2,populationLowerBound:2,timeSpanMs:0,engineeringScreen:false,unknownSegments:['account-size','topic'],refs:[{postAttemptId:'attempt-one',membership:'train',publishedAt:now-2*86400000,observedAt:now-86400000,assessmentId:'assessment-one',originalUntil:proofUntil}],exclusions:[{postAttemptId:'attempt-two',reason:'no-applicable-publication-assessment'}]}},measurements:[{postAttemptId:'attempt-one',replies:2,impressions:100,rate:0.02,staticScore:60}]}],unavailable:[]};
window.results={'performance/calibration:get':window.empty};window.update=value=>{window.results['performance/calibration:get']=value;window.listeners.forEach(cb=>cb());};window.changeRole=role=>{window.store={...window.store,role};window.listeners.forEach(cb=>cb());};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,{initialEntries:['/operations']},React.createElement(TooltipProvider,null,React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(AppShell)},React.createElement(Route,{path:'operations',element:React.createElement(OperationsPage)}))))));`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/calibration-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "calibration-fixture",
      enforce: "pre",
      resolveId(id) {
        for (const key of ["@/lib/store", "@/lib/auth-client"])
          if (id.startsWith(`${root}/src/lib/${key.split("/").at(-1)}`))
            return "\0fixture:" + key;
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id === "\0calibration-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/calibration-fixture")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__calibration-entry"></script>',
            ),
          );
        });
      },
    },
  ],
});
let browser;
const errors = [];
try {
  await server.listen();
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install();
  await page.goto("http://127.0.0.1:5174/calibration-fixture");
  await expect(
    page.getByRole("heading", { name: "Betrieb & Qualität", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Lokaler Lernzweck ist AUS.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Konfiguration fehlt.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Referenzplan unveränderlich speichern" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Systemzustand" }).click();
  await expect(
    page.getByText(
      "Echte Systemzustandsprüfung noch nicht verfügbar (TASK-31).",
    ),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Pilot-Auswertung" }).click();
  await expect(
    page.getByText("Echte Pilot-Auswertung noch nicht verfügbar (TASK-35)."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Algorithmusprofile" }).click();
  await expect(
    page.getByText("Intelligence-Profile werden geladen …"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Kalibrierungsreferenzen" }).click();
  await page.evaluate(() =>
    window.update({
      ...window.empty,
      configuration: window.configuration,
      reason: "CALIBRATION_CONSENT_REQUIRED",
    }),
  );
  await page
    .getByRole("button", {
      name: "Diesem lokalen Lernzweck ausdrücklich zustimmen",
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Diesem lokalen Lernzweck ausdrücklich zustimmen",
    }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/calibration:consent",
    args: {
      workspaceId: "workspace",
      accountId: "account",
      purposeId: "purpose-one",
      purposeFingerprint: "exact-local-evidence-proof",
      enabled: true,
    },
  });
  await page.evaluate(() => {
    window.commands.at(-1).resolve(null);
    window.update(window.complete);
  });
  await expect(
    page.getByText("n=1 · Training 1 · Block 1 0 · Block 2 0"),
  ).toBeVisible();
  await page
    .getByLabel("Native Referenz-Veröffentlichung")
    .selectOption("attempt-one");
  await page.getByLabel("Referenzmodus").selectOption("retrospective");
  for (const [label, value] of [
    ["Rahmen ab (UTC)", "2026-09-01T00:00"],
    ["Trainingsgrenze (UTC)", "2026-09-10T00:00"],
    ["Block 1 ab (UTC)", "2026-09-10T00:00"],
    ["Block 1 bis exklusiv (UTC)", "2026-09-20T00:00"],
    ["Block 2 ab (UTC)", "2026-09-20T00:00"],
    ["Block 2 bis exklusiv (UTC)", "2026-09-30T00:00"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByRole("button", { name: "Referenzplan unveränderlich speichern" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/calibration:createSpec",
    args: {
      accountId: "account",
      referencePostAttemptId: "attempt-one",
      referenceAssessmentId: "assessment-one",
      mode: "retrospective",
      from: Date.parse("2026-09-01T00:00:00Z"),
      fitCutoff: Date.parse("2026-09-10T00:00:00Z"),
    },
  });
  await page.evaluate(() =>
    window.commands.at(-1).reject(Error("Synthetic uncertain response")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Anfrage nicht bestätigt",
  );
  const original = await page.evaluate(() => window.commands.at(-1).args);
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toEqual(
    original,
  );
  await page.getByLabel("Referenz-Account").selectOption("account2");
  await page.evaluate(() => {
    window.commands.at(-1).reject(Error("Old account response"));
    window.update(window.empty);
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Referenz-Account").selectOption("account");
  await page.evaluate(() => window.update(window.complete));
  await page.getByLabel("Gespeicherter Referenzplan").selectOption("spec-one");
  await page.getByLabel("Wissensstand (UTC)").fill("2026-10-06T12:00");
  // Clock follows real session date; use current UTC if the fixed fixture clock is earlier.
  await page
    .getByLabel("Wissensstand (UTC)")
    .fill(
      await page.evaluate(() =>
        new Date(Date.now()).toISOString().slice(0, 16),
      ),
    );
  await page
    .getByText("Messwerte, Herkunft und Ausschlüsse", { exact: true })
    .click();
  await expect(
    page.getByText("2 Antwort-Ereignisse / 100 Impressionen = 0.02000", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByRole("button", { name: /aktivieren|trainieren|rollback/i }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Referenzen nach Wissensstand aufbauen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/calibration:build",
    args: { accountId: "account", specId: "spec-one" },
  });
  await page.evaluate(() => window.commands.at(-1).resolve("new-snapshot"));
  await page.screenshot({
    path: `${evidence}/operations-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(mobile.scroll).toBeLessThanOrEqual(mobile.client);
  const actionButtons = await page.locator("main section button").all();
  expect(actionButtons.length).toBeGreaterThanOrEqual(4);
  for (const button of actionButtons) {
    const size = await button.evaluate((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
    }));
    expect(size.scroll).toBeLessThanOrEqual(size.client);
  }
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: `${evidence}/operations-mobile.png`,
    fullPage: true,
  });
  await page.clock.runFor(20001);
  await expect(
    page.getByText("n=1 · Training 1 · Block 1 0 · Block 2 0"),
  ).toHaveCount(0);
  await expect(
    page.getByText("2 Antwort-Ereignisse / 100 Impressionen = 0.02000", {
      exact: false,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => window.changeRole("Viewer"));
  await expect(
    page.getByText(
      "Owner/Admin-Rechte für Zustimmung, Referenzaufbau und Entfernung erforderlich.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Lokale Lernzweck-Zustimmung widerrufen",
    }),
  ).toBeDisabled();
  await page.clock.runFor(100001);
  await expect(
    page.getByText(
      "Rechtebeleg: Synthetic separate local analysis and measured-outcome permission",
      { exact: true },
    ),
  ).toHaveCount(0);
  const queries = await page.evaluate(() => window.queries),
    commands = await page.evaluate(() =>
      window.commands.map(({ name, args }) => ({ name, args })),
    );
  expect(queries.some((q) => q.name === "intelligence/profiles:get")).toBe(
    true,
  );
  expect(queries.some((q) => q.name === "performance/calibration:get")).toBe(
    true,
  );
  await page.goto("http://127.0.0.1:5174/calibration-fixture?demo=1");
  await expect(page.getByText("Lokale Demo", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Shadow-Kalibrierung" }).click();
  await expect(
    page.getByRole("heading", { name: "Erst im Schatten testen" }),
  ).toBeVisible();
  await page.screenshot({
    path: `${evidence}/operations-demo.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  writeFileSync(
    `${evidence}/receipt.json`,
    JSON.stringify(
      {
        qualification:
          "Actual styled AppShell + Operations + calibration source; mocked auth/store/Convex transport. No live rights, provider or human acceptance.",
        mobile,
        queries,
        commands,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "Actual styled Operations/calibration desktop + 390px + Demo mocked-transport checks PASS",
  );
} finally {
  await browser?.close();
  await server.close();
}
