import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const evidence = "/tmp/dispatch-task43.3-evidence/browser";
mkdirSync(evidence, { recursive: true });
const mocks = {
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useConvex=()=>({});export const useQuery=(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});return useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>args==='skip'?undefined:(args.accountId==='account2'&&name==='performance/models:get'?window.modelEmpty:args.accountId==='account2'&&name==='performance/models:control'?window.controlEmpty:window.results[name]));};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const backendConfigured=true;export const AuthBoundary=({children})=>children;export const authClient={useSession:()=>({data:window.session,isPending:false}),signOut:async()=>({})};export {authPath,returnPath} from '/src/lib/navigation.ts';`,
  "@/lib/store": `import {useState,useSyncExternalStore} from 'react';import {demoMode} from '@/lib/auth-client';export const WorkspaceStoreProvider=({children})=>children;export const useLocalState=(k,i)=>useState(i);export const useWorkspaceLocalState=(k,i)=>{if(!demoMode&&k!=='notification-read')throw Error('Demo hook reached real Operations: '+k);return useState(i);};export const useStore=()=>({state:useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>window.store),setState:()=>{},selectWorkspace:async()=>true,selectAccount:()=>{},createDraft:()=>{throw Error('Demo draft');},mutate:()=>{throw Error('Demo mutation');}});`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AppShell} from '/src/App.tsx';import {OperationsPage} from '/src/pages/Operations.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import '/src/index.css';
window.listeners=new Set();window.commands=[];window.queries=[];window.store={activeWorkspaceId:'workspace',activeAccountId:'account',role:'Owner',preferences:{timezone:'UTC',name:'Synthetic'},workspaces:[{id:'workspace',name:'Synthetic Workspace'}],accounts:[{id:'account',workspaceId:'workspace',name:'Own X',channel:'X'},{id:'account2',workspaceId:'workspace',name:'Other X',channel:'X'}],drafts:[],schedules:[]};
const now=Date.now(),expiresAt=now+120000,proofUntil=now+20000;
window.empty={enabled:false,reason:'CALIBRATION_CONFIGURATION_REQUIRED',configuration:null,choices:[],choicesPartial:false,specs:[],snapshots:[],unavailable:[]};
window.configuration={id:'purpose-one',fingerprint:'exact-local-evidence-proof',version:'isolated-local-v1',rightsEvidence:'Synthetic separate local analysis and measured-outcome permission',explanation:'Local reply ordering only',expiresAt,retentionMs:86400000,withdrawn:false};
window.spec={_id:'spec-one',purposeId:'purpose-one',createdAt:now-120000,expiresAt:proofUntil,payload:{holdout1Start:now+5000,holdout1End:now+10000,holdout2Start:now+19000,mode:'prospective',prospectiveStatus:'candidate-not-frozen',holdout2End:now+15*86400000,compatibility:{resolvedModel:'jev-1.13.0',questionVersion:'jev-post-analysis-v1',normalizationVersion:'jev-normalization-v1',formulaVersion:'dispatch-score-v1',metricVersion:'exact-metric-v1',dialect:'post-fields-repost-v2',algorithmId:'algorithm-one',audienceId:'audience-one'}}};
window.complete={enabled:true,reason:null,configuration:window.configuration,choices:[{postAttemptId:'attempt-one',assessmentId:'assessment-one',publishedAt:now-2*86400000,versionNumber:1,requestedModel:'jev-1.13.0',resolvedModel:'jev-1.13.0',expiresAt:proofUntil}],choicesPartial:false,specs:[window.spec],snapshots:[{row:{_id:'snapshot-one',specId:'spec-one',expiresAt:proofUntil,payload:{asOf:now,counts:{n:1,train:1,block1:0,block2:0},frameComplete:true,scanned:2,populationTotal:2,populationLowerBound:2,timeSpanMs:0,engineeringScreen:false,unknownSegments:['account-size','topic'],refs:[{postAttemptId:'attempt-one',membership:'train',publishedAt:now-2*86400000,observedAt:now-86400000,assessmentId:'assessment-one',originalUntil:proofUntil}],exclusions:[{postAttemptId:'attempt-two',reason:'no-applicable-publication-assessment'}]}},measurements:[{postAttemptId:'attempt-one',replies:2,impressions:100,rate:0.02,staticScore:60}]}],unavailable:[]};
window.modelEmpty={experiments:[],selectedId:null,experiment:null,candidate:null,evaluation:null,reason:null,proofUntil:null,activationEligible:false};
window.modelExperiment={_id:'experiment-one',purposeId:'purpose-one',specId:'spec-one',payload:{mode:'prospective',policy:null,predeclaredAt:now-10000,lossVersion:'twice-discordance-v1',compatibility:window.spec.payload.compatibility}};
window.modelCandidate={_id:'candidate-one',payload:{n:1,spanMs:0,baseline:{pairs:0,targetTies:0,loss:null},transfer:null,frozenAt:now-5000}};
const block={n:0,baseline:{pairs:0,targetTies:0,loss:null},candidate:{loss:null},improvement:null,drift:{clarity:null,discussion:null,replyRate:null}};
window.modelEvaluation={payload:{asOf:now,trainN:1,engineeringScreen:false,engineeringScreenBasis:"unvalidated-30-posts-28-days",evidenceQualified:false,activationEligible:false,block1:block,block2:block,stability:null,excludedFraction:.5,populationTotal:2,populationLowerBound:2,scanned:2,reasons:['empirical-policy-unset','immature-or-incomplete-frame'],unknownSegments:['account-size','topic','timezone','unseen-version-strata']}};
window.modelComplete={...window.modelEmpty,experiments:[{id:'experiment-one',createdAt:now-10000,mode:'prospective'}],selectedId:'experiment-one',experiment:window.modelExperiment,proofUntil};
window.updateModel=value=>{window.results['performance/models:get']=value;window.listeners.forEach(cb=>cb());};
window.controlEmpty={revision:0,activeDecisionId:null,declarations:[],declaration:null,check:null,state:'static',reason:'CALIBRATION_MONITORING_POLICY_UNSET',proofUntil:null,operatingUntil:null};
window.controlPolicy={minBlockN:2,minBlockSpanMs:1,maxExcludedFraction:1,minImprovement:0,maxClarityDrift:1,maxDiscussionDrift:1,maxReplyRateDrift:2,reviewUntil:now+19000,finalValidUntil:now+18000,evidence:'Synthetic UI evidence; not actual permission',rationale:'Synthetic mechanics only'};
window.monitorSpec={...window.spec,_id:'monitor-spec',createdAt:now-1000};
window.monitorSnapshot={_id:'monitor-snapshot',specId:'monitor-spec',expiresAt:proofUntil,payload:{...window.complete.snapshots[0].row.payload,refs:[],exclusions:[],unknownSegments:[],asOf:now+10000,counts:{n:3,train:1,block1:2,block2:0},frameComplete:true}};
window.controlDeclaration={_id:'declaration-one',candidateId:'candidate-one',specId:'monitor-spec',createdAt:now,expiresAt:proofUntil,payload:{firstEnd:now+10000,unusedSecondStart:now+19000,evaluationId:'evaluation-one',policy:window.controlPolicy,compatibility:window.spec.payload.compatibility}};
window.controlDeclared={...window.controlEmpty,declarations:[{id:'declaration-one',createdAt:now,firstEnd:now+10000,unusedSecondStart:now+19000,finalValidUntil:now+18000}],declaration:window.controlDeclaration,proofUntil,reason:'CALIBRATION_MONITORING_FIRST_BLOCK_NOT_MATURE'};
window.updateControl=value=>{window.results['performance/models:control']=value;window.listeners.forEach(cb=>cb());};
window.results={'performance/models:control':window.controlEmpty,'performance/calibration:get':window.empty,'performance/models:get':window.modelEmpty};window.update=value=>{window.results['performance/calibration:get']=value;window.listeners.forEach(cb=>cb());};window.changeRole=role=>{window.store={...window.store,role};window.listeners.forEach(cb=>cb());};
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
  await expect(
    page.getByRole("heading", {
      name: "Kalibrierung im Schattenbetrieb",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Empirische Politik standardmäßig NULL:", { exact: false }),
  ).toBeVisible();
  await page
    .getByLabel("Plan für neuen Schattenversuch")
    .selectOption("spec-one");
  const declareButton = page.getByRole("button", {
    name: "Diagnostischen Schattenversuch mit NULL-Politik vorerklären",
  });
  await declareButton.click();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/models:predeclare",
    args: { accountId: "account", specId: "spec-one", policy: null },
  });
  await expect(declareButton).toBeDisabled();
  await page.evaluate(() => {
    window.commands.at(-1).resolve("experiment-one");
    window.updateModel(window.modelComplete);
  });
  await expect(page.getByLabel("Gespeicherter Schattenversuch")).toHaveValue(
    "experiment-one",
  );
  await page
    .getByLabel("Native Materialisierung für diesen Versuch")
    .selectOption("snapshot-one");
  const freezeButton = page.getByRole("button", {
    name: "Nur Training anpassen und Kandidat unveränderlich einfrieren",
  });
  await freezeButton.click();
  await expect(freezeButton).toBeDisabled();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/models:fit",
    args: { experimentId: "experiment-one", snapshotId: "snapshot-one" },
  });
  await page.evaluate(() => {
    window.commands.at(-1).resolve("candidate-one");
    window.updateModel({
      ...window.modelComplete,
      candidate: window.modelCandidate,
    });
  });
  await expect(
    page.getByText("Unabhängige Trainingsfälle n=1", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("nicht verfügbar: keine vergleichbaren Paare", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Eingefrorenen Kandidaten mit Baseline vergleichen",
    })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/models:compare",
  });
  await page.evaluate(() => {
    window.commands.at(-1).reject(new Error("unconfirmed-network"));
  });
  await expect(page.getByRole("alert")).toContainText(
    "Anfrage nicht bestätigt",
  );
  const replayName = await page.evaluate(
    () => window.commands.at(-1).args.commandKey,
  );
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(
    await page.evaluate(() => window.commands.at(-1).args.commandKey),
  ).toBe(replayName);
  await page.evaluate(() => {
    window.commands.at(-1).resolve("evaluation-one");
    window.updateModel({
      ...window.modelComplete,
      candidate: window.modelCandidate,
      evaluation: window.modelEvaluation,
    });
  });
  await expect(
    page.getByText("Evidenzqualifikation nicht erfüllt", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Block 1: unabhängiges n=0", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.updateModel({
      ...window.modelComplete,
      candidate: window.modelCandidate,
      experiment: {
        ...window.modelExperiment,
        payload: { ...window.modelExperiment.payload, mode: "retrospective" },
      },
    }),
  );
  await expect(
    page.getByText("Retrospektiv · dauerhaft nur Diagnose · Politik", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Referenz-Account").selectOption("account2");
  await expect(
    page.getByText("Unabhängige Trainingsfälle n=1", { exact: false }),
  ).toHaveCount(0);
  await page.getByLabel("Referenz-Account").selectOption("account");
  await expect(
    page.getByText("Unabhängige Trainingsfälle n=1", { exact: false }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.updateModel({
      ...window.modelComplete,
      candidate: window.modelCandidate,
      evaluation: window.modelEvaluation,
    }),
  );
  await expect(
    page.getByText("Betriebspolitik UNGESETZT.", { exact: false }),
  ).toBeVisible();
  await page
    .getByText("Neue Betriebspolitik ausdrücklich vorerklären", { exact: true })
    .click();
  const bind = page.getByRole("button", {
    name: "Betriebspolitik und Kontrollplan unveränderlich binden",
  });
  await expect(bind).toBeDisabled();
  for (const label of [
    "Unabhängige Mindestfälle im Kontrollblock",
    "Minimaler Nutzen im Paarordnungsfehler (0–1)",
    "Maximale Antwortraten-Drift (Ereignisse/Impressionen)",
  ])
    await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  await page.evaluate(() => {
    window.updateModel({
      ...window.modelComplete,
      candidate: {
        ...window.modelCandidate,
        payload: { ...window.modelCandidate.payload, transfer: 0.025 },
      },
      evaluation: {
        ...window.modelEvaluation,
        _id: "evaluation-one",
        payload: { ...window.modelEvaluation.payload, evidenceQualified: true },
      },
    });
    window.update({
      ...window.complete,
      specs: [window.spec, window.monitorSpec],
    });
  });
  await page
    .getByLabel("Neuer prospektiver Kontrollplan")
    .selectOption("monitor-spec");
  for (const [label, value] of [
    ["Unabhängige Mindestfälle im Kontrollblock", "2"],
    ["Mindestspanne im Kontrollblock (ms)", "1"],
    ["Maximaler Ausschlussanteil im gesamten Rahmen (0–1)", "1"],
    ["Maximale Klarheitsdrift (0–1)", "1"],
    ["Maximale Diskussionsdrift (0–1)", "1"],
    ["Maximale Antwortraten-Drift (Ereignisse/Impressionen)", "2"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page
    .getByLabel("Betriebspolitik prüfen bis (UTC)")
    .fill(
      await page.evaluate(() =>
        new Date(window.controlPolicy.reviewUntil)
          .toISOString()
          .slice(0, 19)
          .replace(/:00$/, ""),
      ),
    );
  await page
    .getByLabel("Absolute Betriebs-Endfrist (UTC)")
    .fill(
      await page.evaluate(() =>
        new Date(window.controlPolicy.finalValidUntil)
          .toISOString()
          .slice(0, 19)
          .replace(/:00$/, ""),
      ),
    );
  await page
    .getByLabel("Tatsächlicher Betriebspolitik-Beleg")
    .fill("Synthetic UI evidence; not actual permission");
  await page
    .getByLabel("Begründung der erklärten Betriebspolitik")
    .fill("Synthetic mechanics only");
  await expect(bind).toBeDisabled();
  await page
    .getByLabel("Minimaler Nutzen im Paarordnungsfehler (0–1)", { exact: true })
    .fill("0");
  await expect(bind).toBeEnabled();
  await bind.click();
  await expect(bind).toBeDisabled();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/models:declareMonitoring",
    args: {
      candidateId: "candidate-one",
      evaluationId: "evaluation-one",
      monitoringSpecId: "monitor-spec",
      policy: { minBlockN: 2, minImprovement: 0, maxReplyRateDrift: 2 },
    },
  });
  await page.evaluate(() => {
    window.commands.at(-1).resolve("declaration-one");
    window.updateControl(window.controlDeclared);
  });
  await expect(
    page.getByRole("button", {
      name: "Exakten Kandidaten bis zur Endfrist freigeben",
    }),
  ).toBeDisabled();
  await page.clock.runFor(10001);
  await page.evaluate(() =>
    window.update({
      ...window.complete,
      specs: [window.spec, window.monitorSpec],
      snapshots: [
        ...window.complete.snapshots,
        { row: window.monitorSnapshot, measurements: [] },
      ],
    }),
  );
  await page
    .getByLabel("Native Kontrollmaterialisierung")
    .selectOption("monitor-snapshot");
  await page
    .getByRole("button", { name: "Reifen Kontrollblock abschließend prüfen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/models:checkMonitoring",
    args: {
      declarationId: "declaration-one",
      snapshotId: "monitor-snapshot",
      block: 1,
    },
  });
  await page.evaluate(() => {
    window.commands.at(-1).resolve("check-one");
    window.updateControl({
      ...window.controlDeclared,
      check: { _id: "check-one", payload: { status: "pass" } },
      reason: "CALIBRATION_OWNER_ACTIVATION_REQUIRED",
    });
  });
  const activate = page.getByRole("button", {
    name: "Exakten Kandidaten bis zur Endfrist freigeben",
  });
  await activate.click();
  await expect(activate).toBeDisabled();
  const activationRequest = await page.evaluate(
    () => window.commands.at(-1).args,
  );
  await page.evaluate(() =>
    window.commands.at(-1).reject(Error("uncertain activation receipt")),
  );
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toEqual(
    activationRequest,
  );
  await page.evaluate(() => {
    window.commands.at(-1).resolve("decision-one");
    window.updateControl({
      ...window.controlDeclared,
      revision: 1,
      activeDecisionId: "decision-one",
      check: { _id: "check-one", payload: { status: "pass" } },
      reason: null,
      state: "candidate",
      operatingUntil: window.controlPolicy.finalValidUntil,
    });
  });
  await expect(
    page.getByText("Befristete Kandidatenprojektion freigegeben", {
      exact: false,
    }),
  ).toBeVisible();
  await page.evaluate(() => window.changeRole("Admin"));
  await expect(
    page.getByRole("button", {
      name: "Exakten Kandidaten bis zur Endfrist freigeben",
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Zur ursprünglichen statischen Formel zurückkehren",
    }),
  ).toBeDisabled();
  await page.evaluate(() => window.changeRole("Owner"));
  await page
    .getByRole("button", {
      name: "Zur ursprünglichen statischen Formel zurückkehren",
    })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1))).toMatchObject({
    name: "performance/models:rollback",
    args: { expectedRevision: 1, accountId: "account" },
  });
  await page.evaluate(() => {
    window.commands.at(-1).resolve("rollback-one");
    window.updateControl({
      ...window.controlDeclared,
      revision: 2,
      activeDecisionId: null,
      check: { _id: "check-one", payload: { status: "pass" } },
      reason: "CALIBRATION_OWNER_ACTIVATION_REQUIRED",
    });
  });
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
    page.getByText("Unabhängige Trainingsfälle n=1", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Schattennachweis nicht verfügbar:", { exact: false }),
  ).toBeVisible();
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
