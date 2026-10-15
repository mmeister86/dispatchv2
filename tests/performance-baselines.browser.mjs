import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client": "export const demoMode=false;",
  "@/lib/store":
    "export const useStore=()=>({state:window.store});export const useWorkspaceLocalState=()=>{throw Error('Demo invoked');};",
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});return useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>args==='skip'?undefined:window.results[name]);};export const useMutation=ref=>async args=>{window.mutations.push({name:getFunctionName(ref),args});if(window.failNext){window.failNext=false;return new Promise((_,reject)=>window.rejectConsent=reject);}};export const useAction=useMutation;`,
};
const entry = `import '/src/index.css';import React from 'react';import ReactDOM from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';import {AnalyticsPage} from '/src/pages/Analytics.tsx';import {RealIdeas} from '/src/features/ideas/ideas.tsx';import {describe} from '/convex/performance/baselines.ts';
window.listeners=new Set();window.queries=[];window.mutations=[];window.store={activeWorkspaceId:'workspace',activeAccountId:'account',role:'Owner',accounts:[{id:'account',workspaceId:'workspace',channel:'X',name:'Own X'},{id:'account2',workspaceId:'workspace',channel:'X',name:'Other own X'}]};
const now=Date.now(), expiresAt=now+30000;
const fields=n=>[{name:'impressions',rawField:'public_metrics.impression_count',definition:'Repeated impressions; not unique audience',status:'measured',value:n},...['likes','replies','reposts','quotes','url_clicks'].map(name=>({name,rawField:'public_metrics.'+name,definition:name,status:'measured',value:0}))];
const units=[100,300].map((n,i)=>({scheduleId:'schedule'+i,versionId:'version'+i,externalId:''+(101+i),position:0,coverage:{confirmed:1,total:1},mediaType:'none',topic:'Original published topic',topicUntil:expiresAt,timezone:'Europe/Berlin',snapshots:[{_id:'snapshot'+i,windowHours:24,state:'observed',providerCreatedAt:now-(i*2+1)*86400000,observedAt:now-i*2*86400000,expiresAt,definitionVersion:'synthetic-v1',dialect:'post-fields-repost-v2',fields:fields(n)}]}));
const baseline=describe(units,now,'account');
window.results={'performance/snapshots:overview':{enabled:false,reason:'OWN_METRICS_PAUSED',configuration:{id:'metrics-policy',fingerprint:'synthetic-proof',windows:[24],unitMicros:1,currency:'USD'},posts:units.map((u,i)=>({...u,network:'x',contentType:'post',postAttemptId:'attempt'+i,confirmedAt:u.snapshots[0].providerCreatedAt,knowledge:{id:'knowledge'+i,capturedAt:u.snapshots[0].providerCreatedAt,assessmentId:i===0?'assessment0':null,applicable:i===0,reason:null,assessment:i===0?{_id:'assessment0',sourceUntil:expiresAt,provenance:{resolvedModel:'synthetic-then-model',requestedModel:'synthetic-then-model'},result:{questionVersion:'jev-post-analysis-v1',score:{formulaVersion:'dispatch-score-v1',aggregate:42,history:{value:0.5}}}}:null},snapshots:u.snapshots.map(r=>({...r,dueAt:r.observedAt,requestedAt:r.observedAt,confirmedAt:r.providerCreatedAt,late:false,reason:null}))})),baseline},'performance/history:overview':{reason:'OWN_HISTORY_CONFIGURATION_REQUIRED',policy:null,maxResults:null,jobs:[],posts:[]},'content/feedback:list':[],'content/ideas:list':{page:[],isDone:true,continueCursor:''},'ai/runs:availability':{available:false,reason:'NOT_CONFIGURED'},'content/performance:context':{enabled:false,reason:'PERFORMANCE_CONTENT_CONFIGURATION_REQUIRED',configuration:null,entries:[]}};
window.update=(name,data)=>{window.results[name]=data;window.listeners.forEach(cb=>cb());};
window.context={enabled:true,reason:null,configuration:{id:'context-policy',fingerprint:'exact-proof',expiresAt,purpose:'own-performance-human-content-v1'},entries:[{kind:'performance_signal',asOf:now,cohort:baseline.cohorts[0].key,definitionVersion:'synthetic-v1',expiresAt,snapshotIds:['snapshot0','snapshot1'],versionIds:['version0','version1'],knowledgeIds:['knowledge0'],assessmentIds:[],n:2,meanImpressions:200,denominators:[{name:'engagement',components:['likes','replies','reposts','quotes'],missing:[],n:2,numerator:0,denominator:400}],summary:'Eigene Post-Kohorte: Impressionen Mittel 200, n=2; Teilmenge, deskriptiv, keine Reichweitenprognose.'}]};
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter,null,React.createElement(location.pathname.includes('content')?RealIdeas:AnalyticsPage)));`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/task42-fixture-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "task42-fixture",
      enforce: "pre",
      resolveId(id) {
        for (const key of ["@/lib/store", "@/lib/auth-client"])
          if (id.startsWith(`${root}/src/lib/${key.split("/").at(-1)}`))
            return "\0fixture:" + key;
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id === "\0task42-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!["/task42-analytics", "/task42-content"].includes(req.url))
            return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__task42-entry"></script>',
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
  await page.goto("http://127.0.0.1:5174/task42-analytics");
  await expect(
    page.getByRole("heading", {
      name: "Eigene Account-Baselines",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("n=2 geeignete Einheiten")).toBeVisible();
  await expect(
    page.getByText("Kleine eigene Referenzgruppe:", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Gemessene tägliche Impressionen; fehlende Tage bleiben Lücken",
    }),
  ).toBeVisible();
  await page.getByText("Tageswerte und Lücken").click();
  await expect(page.getByText(/: — · n=0 · fehlend 0/)).toBeVisible();
  await page.getByLabel("Beobachtungsalter").selectOption("48");
  await page.getByLabel("Vergleichsformat").selectOption("thread");
  await page.getByLabel("Publiziert ab (UTC)").fill("2026-10-01");
  await page.getByLabel("Publiziert bis (UTC)").fill("2026-10-06");
  const query = await page.evaluate(() =>
    window.queries
      .filter((q) => q.name === "performance/snapshots:overview")
      .at(-1),
  );
  expect(query.args).toMatchObject({
    accountId: "account",
    windowHours: 48,
    format: "thread",
    from: Date.parse("2026-10-01T00:00:00Z"),
    to: Date.parse("2026-10-06T23:59:59.999Z"),
  });
  await page.getByLabel("Publiziert ab (UTC)").fill("2026-10-07");
  await expect(page.getByLabel("Publiziert ab (UTC)")).toBeVisible();
  await expect(
    page.getByText("Wähle einen geordneten Zeitraum von höchstens 366 Tagen."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Messwerte löschen" }),
  ).toBeVisible();
  await page.getByLabel("Publiziert ab (UTC)").fill("2026-10-01");
  await page.getByLabel("Beobachtungsalter").selectOption("24");
  await page.getByLabel("Vergleichsformat").selectOption("all");
  const analyticsQueries = await page.evaluate(() => window.queries);
  expect(
    analyticsQueries
      .filter((q) => q.name === "performance/snapshots:overview")
      .at(-1).args,
  ).toMatchObject({ windowHours: 24 });
  expect(
    analyticsQueries
      .filter((q) => q.name === "performance/snapshots:overview")
      .at(-1).args.format,
  ).toBeUndefined();
  await expect(
    page.getByText("Inhaltsbewertung damals: 42 / 100", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/task42-evidence/analytics-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const analyticsMobileWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));

  expect(analyticsMobileWidth.scroll).toBeLessThanOrEqual(
    analyticsMobileWidth.client,
  );
  await page.screenshot({
    path: "/tmp/task42-evidence/analytics-mobile.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5174/task42-content");
  await expect(
    page.getByRole("heading", {
      name: "Performance-Kontext für Content",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Content-Kontext aktivieren" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.update("content/performance:context", {
      ...window.context,
      enabled: false,
      entries: [],
    }),
  );
  await page
    .getByRole("button", { name: "Content-Kontext aktivieren" })
    .click();
  expect(await page.evaluate(() => window.mutations.at(-1))).toMatchObject({
    name: "content/performance:consent",
    args: {
      accountId: "account",
      enabled: true,
      policyId: "context-policy",
      policyFingerprint: "exact-proof",
    },
  });
  await page.evaluate(() =>
    window.update("content/performance:context", window.context),
  );
  await expect(
    page.getByText("Eigene Post-Kohorte:", { exact: false }),
  ).toBeVisible();
  await page.getByText("Quellen, Definition und Nenner").click();
  await expect(
    page.getByText("engagement: n=2, Zähler 0, Nenner Impressionen 400"),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: "/tmp/task42-evidence/content-context.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const contentMobileWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(contentMobileWidth.scroll).toBeLessThanOrEqual(
    contentMobileWidth.client,
  );
  await page.screenshot({
    path: "/tmp/task42-evidence/content-mobile.png",
    fullPage: true,
  });
  await page.evaluate(() => (window.failNext = true));
  await page.getByRole("button", { name: "Content-Kontext pausieren" }).click();
  await page.getByLabel("Kontext-Account").selectOption("account2");
  await page.evaluate(() =>
    window.rejectConsent(Error("Synthetic old-account failure")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByLabel("Kontext-Account").selectOption("account");
  expect(await page.evaluate(() => window.mutations.at(-1))).toMatchObject({
    name: "content/performance:consent",
    args: { accountId: "account", enabled: false },
  });
  await page.clock.runFor(30001);
  await expect(
    page.getByText("Eigene Post-Kohorte:", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Separate bestätigte Content-Verarbeitungsrechte fehlen", {
      exact: false,
    }),
  ).toBeVisible();
  await page.evaluate(() =>
    window.update("content/performance:context", {
      ...window.context,
      enabled: false,
      entries: [],
      configuration: {
        ...window.context.configuration,
        expiresAt: Date.now() + 1000,
      },
    }),
  );
  await expect(
    page.getByText("Content-Kontext ist pausiert.", { exact: false }),
  ).toBeVisible();
  await page.clock.runFor(1001);
  await expect(
    page.getByText("Separate bestätigte Content-Verarbeitungsrechte fehlen", {
      exact: false,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  writeFileSync(
    "/tmp/task42-evidence/browser.receipt.json",
    JSON.stringify(
      {
        qualified:
          "Actual mounted styled React surfaces with mocked Convex/auth/store transport; no real auth/provider/customer data acceptance",
        analyticsMobileWidth,
        contentMobileWidth,
        analyticsQueries,
        contentQueries: await page.evaluate(() => window.queries),
        mutations: await page.evaluate(() => window.mutations),
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "TASK42 mounted styled mocked-transport Analytics/Content/browser controls PASS",
  );
} finally {
  await browser?.close();
  await server.close();
}
