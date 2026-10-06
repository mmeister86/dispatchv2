import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client": `export const demoMode=false;`,
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});return useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>name==='intelligence/assessments:get'?window.rows[args.draftVersionId]??window.blank:name==='intelligence/assessments:history'?window.historyRows:name==='ai/jev/access:availability'?window.availability:undefined);};export const useAction=ref=>getFunctionName(ref)==="intelligence/assessments:analyze"?args=>new Promise((resolve,reject)=>window.pending.push({name:getFunctionName(ref),args,resolve,reject})):async()=>null;export const useMutation=()=>async()=>null;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/store": `import {useSyncExternalStore} from 'react';export const useStore=()=>{const state=useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>window.store.state);return {...window.store,state};};`,
};
const entry = `import "/src/index.css";import React from 'react';import ReactDOM from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router-dom';import {ComposerPage} from '/src/pages/Drafts.tsx';import {CalendarPage} from '/src/pages/Calendar.tsx';import {createSeed} from '/src/lib/model.ts';
window.pending=[];window.listeners=new Set();window.queries=[];window.blank={assessment:null,applicable:false,sourceUntil:null};window.rows={};window.historyRows={page:[],isDone:true,continueCursor:''};window.availability={status:'ready',guidance:'Synthetic ready'};window.recovery={aborted:false,positions:[{position:0,stage:"confirmed",errorCode:null,notBefore:null},{position:1,stage:"unknown",errorCode:null,notBefore:null}]};
const seed=createSeed(),ws=seed.activeWorkspaceId;
const account={...seed.accounts.find(a=>a.channel==='X' && a.workspaceId===ws),connection:'connected',capability:{maxText:280,maxThread:100,maxMedia:4,mediaTypes:['image'],publish:false},xEvidence:{scopes:['tweet.write','tweet.read','users.read','media.write'],identityVerifiedAt:1,connectionSequence:1,textScopeEligible:true,mediaScopeEligible:true,liveWrite:'unverified'}};
const asset={id:'media',workspaceId:ws,name:'Approved image',alt:'Changed library default',type:'image',size:70,status:'ready',origin:'R2',url:'',mime:'image/png'};
const draft={id:'thread',workspaceId:ws,title:'Exact approved thread',accountId:account.id,pillar:'',strategy:'generic',comments:[],revision:1,versions:[{id:'version-one',number:1,text:['Exact approved first','Exact approved second'],mediaIds:[],media:[],createdAt:new Date().toISOString(),reason:'Fixture'}]};
const command=(kind,args)=>new Promise(resolve=>window.pending.push({kind,args,resolve}));
const no=()=>false;
window.store={state:{...seed,role:'Owner',accounts:[account],media:[],drafts:[draft],schedules:[]},approveFirstWrite:d=>command('approve',{versionId:d.versions.at(-1).id,accountId:d.accountId}),confirmFirstWrite:(d,id)=>command('confirm',{versionId:d.versions.at(-1).id,accountId:d.accountId,approvalId:id}),saveDraft:d=>command('save',d),approveVersion:async()=>false,revokeApproval:async()=>false,cancelSchedule:s=>command('cancel',{scheduleId:s.id,expectedGeneration:s.generation}),replaceSchedule:async()=>false,createDraft:async()=>'',loadMoreVersions:no,hasMoreVersions:false,loadMoreMedia:no,hasMoreMedia:false,members:[],mutate:no,addComment:async()=>false,resolveComment:async()=>false,assignDraft:async()=>false};
window.update=(fn)=>{window.store.state=fn(window.store.state);window.listeners.forEach(cb=>cb());};
const root=ReactDOM.createRoot(document.getElementById('root')),router=createMemoryRouter([{path:'/drafts/:id',element:React.createElement(ComposerPage)},{path:'/calendar',element:React.createElement(CalendarPage)}],{initialEntries:['/drafts/thread']});
window.router=router;root.render(React.createElement(React.StrictMode,null,React.createElement(RouterProvider,{router})));
`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/assessment-fixture-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "assessment-fixture",
      enforce: "pre",
      resolveId(id) {
        for (const key of ["@/lib/store", "@/lib/auth-client"])
          if (id.startsWith(`${root}/src/lib/${key.split("/").at(-1)}`))
            return `\0fixture:${key}`;
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0thread-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url !== "/thread-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__thread-entry"></script>',
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
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174/thread-fixture");
  const tab = page.getByRole("tab", { name: "Intelligence", exact: true });
  await expect(tab).toBeEnabled();
  await tab.click();
  const start = page.getByRole("button", {
    name: "Gespeicherte Version analysieren",
    exact: true,
  });
  await expect(start).toBeEnabled();
  await page.evaluate(() => {
    window.availability = {
      status: "disabled",
      guidance: "Vollständige EU-Freigabe erforderlich.",
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(start).toBeDisabled();
  await expect(
    page.getByText("Vollständige EU-Freigabe erforderlich."),
  ).toBeVisible();
  await page.evaluate(() => {
    window.availability = { status: "ready", guidance: "Synthetic ready" };
    window.listeners.forEach((cb) => cb());
  });
  await start.click();
  await expect(
    page.getByRole("button", { name: "Bewertung läuft …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending[0].args.draftVersionId)).toBe(
    "version-one",
  );
  expect(
    await page.evaluate(() => Object.keys(window.pending[0].args).sort()),
  ).toEqual([
    "accountId",
    "draftId",
    "draftVersionId",
    "operationKey",
    "workspaceId",
  ]);
  await page.evaluate(() =>
    window.pending[0].reject(new Error("transport fixture failure")),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "Bewertung nicht verfügbar" }),
  ).toContainText("Bewertung nicht verfügbar");
  await page
    .getByRole("button", { name: "Bewertung erneut versuchen" })
    .click();
  expect(
    await page.evaluate(
      () =>
        window.pending[1].args.operationKey ===
        window.pending[0].args.operationKey,
    ),
  ).toBe(false);
  const assessment = {
    _id: "assessment-one",
    _creationTime: 1,
    workspaceId: "fixture",
    accountId: "fixture",
    draftId: "thread",
    draftVersionId: "version-one",
    versionNumber: 1,
    algorithmId: "algorithm-v1",
    audienceId: "audience-v1",
    semanticKey: "semantic-hash",
    inputVersion: "dispatch-assessment-input-v1",
    attemptId: "owned-receipt",
    createdAt: Date.now(),
    sourceUntil: null,
    provenance: {
      policyId: "policy-v1",
      policyVersion: "price-v1",
      requestedModel: "jev-1.13.0",
      resolvedModel: "jev-1.13.0",
      inputTokens: 20,
      outputTokens: 10,
      sentAt: Date.now(),
      settledAt: Date.now(),
      latencyMs: 12,
      selectionRevision: 1,
    },
    result: {
      outcome: "success",
      questionVersion: "jev-post-analysis-v1",
      normalizationVersion: "jev-normalization-v1",
      answers: {
        hookStrength: { type: "score", value: 0.625, confidence: 0.9 },
      },
      deterministic: {
        version: "structure-v1",
        segments: [],
        media: { present: false, count: 0, images: 0, videos: 0, withAlt: 0 },
        structure: 1,
      },
      score: {
        aggregate: 65,
        formulaVersion: "dispatch-score-v1",
        thresholdVersion: "jev-confidence-startup-v1",
        missing: [],
        lowConfidence: [],
        history: { value: 0.5, basis: "assumed_cold_start_baseline" },
      },
    },
  };
  await page.evaluate((r) => {
    window.rows["version-one"] = {
      assessment: r,
      applicable: true,
      sourceUntil: null,
    };
    window.pending[1].resolve({ outcome: "success", cached: false });
    window.listeners.forEach((cb) => cb());
  }, assessment);
  await expect(
    page.getByText("Aktuell anwendbare Bewertung", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("65 / 100", { exact: true })).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Profil-, Eingabe- und Aufrufnachweis" })
    .click();
  await expect(
    page.getByText("Nutzung verbucht", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .locator("details")
      .filter({ hasText: "Profil-, Eingabe- und Aufrufnachweis" }),
  ).not.toContainText(/abgerechnet|bezahlt|Rechnung/i);
  await page.screenshot({
    path: "/tmp/task28.3-composer-result.png",
    fullPage: true,
  });
  await page.locator("textarea").first().fill("Unsaved new text");
  await expect(start).toBeDisabled();
  await expect(
    page.getByText("Veraltete / derzeit nicht anwendbare Bewertung", {
      exact: true,
    }),
  ).toBeVisible();
  await page.locator("textarea").first().fill("Exact approved first");
  await expect(start).toBeEnabled();
  await start.click();
  await page.evaluate(() => {
    window.update((s) => ({ ...s, role: "Viewer" }));
    window.pending[2].resolve({ outcome: "success", cached: false });
  });
  await expect(start).toBeDisabled();
  await expect(
    page.getByText("Bewertung gespeichert.", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.update((s) => ({ ...s, role: "Owner" })));
  await expect(start).toBeEnabled();
  await start.click();
  await page.evaluate(() => {
    window.update((s) => ({
      ...s,
      drafts: s.drafts.map((d) => ({
        ...d,
        revision: 2,
        versions: [
          ...d.versions,
          {
            ...d.versions[0],
            id: "version-two",
            number: 2,
            text: ["New saved text"],
          },
        ],
      })),
    }));
    window.pending[3].resolve({ outcome: "success", cached: false });
  });
  await expect(
    page.getByText("Gespeicherte Version 2", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("65 / 100", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Bewertung gespeichert.", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.queries.some(
        (q) =>
          q.name === "intelligence/assessments:get" &&
          q.args.draftVersionId === "version-two",
      ),
    ),
  ).toBe(true);
  // Historical-only source deadline must hide while current version has no source clock and without DB notifications.
  await page.evaluate((r) => {
    window.historyRows = {
      page: [
        {
          ...r,
          _id: "history-protected",
          draftVersionId: "historical-version",
          versionNumber: 0,
          sourceUntil: Date.now() + 350,
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.listeners.forEach((cb) => cb());
  }, assessment);
  await expect(
    page.locator("summary").filter({ hasText: "Version 0" }),
  ).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: "Version 0" }),
  ).toHaveCount(0, {
    timeout: 3000,
  });
  await page.evaluate(() =>
    window.update((s) => ({
      ...s,
      drafts: s.drafts.map((d) => ({
        ...d,
        versions: d.versions.map((v) => ({ ...v, sourceUnavailable: true })),
      })),
    })),
  );
  await expect(
    page.getByText(
      "Quelle nicht mehr verfügbar. Geschützte Bewertungen sind ausgeblendet.",
    ),
  ).toBeVisible();
  await expect(page.getByText("65 / 100", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/task28.3-composer.png", fullPage: true });
  expect(errors).toEqual([]);
  console.log(
    "Actual styled Composer: production tab, default-OFF guidance, saved ID/awaited failure/new retry, dirty guard, role epoch, idle historical expiry, withdrawal PASS. Transport mocked; no live auth/model/manual acceptance.",
  );
} finally {
  await browser?.close();
  await server.close();
}
