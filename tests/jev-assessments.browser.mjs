import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtempSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client": `export const demoMode=false;export const authClient={useSession:()=>({data:window.session,isPending:false}),signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};`,
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useConvex=()=>({});export const useQuery=(ref,args)=>{const name=getFunctionName(ref);window.queries.push({name,args});return useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>name==='intelligence/assessments:get'?window.rows[args.draftVersionId]??window.blank:name==='intelligence/assessments:history'?window.historyRows:name==='ai/jev/access:availability'?window.availability:name==='intelligence/recommendations:compare'?window.compareRow:undefined);};export const useAction=ref=>getFunctionName(ref)==="intelligence/assessments:analyze"?args=>new Promise((resolve,reject)=>window.pending.push({name:getFunctionName(ref),args,resolve,reject})):async()=>null;export const useMutation=ref=>getFunctionName(ref)==='intelligence/recommendations:adopt'?args=>new Promise((resolve,reject)=>window.pending.push({name:getFunctionName(ref),args,resolve,reject})):async()=>null;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/store": `import {useSyncExternalStore} from 'react';export const useStore=()=>{const state=useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>window.store.state);return {...window.store,state};};`,
};
const entry = `import "/src/index.css";import React from 'react';import ReactDOM from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router-dom';import {ComposerPage} from '/src/pages/Drafts.tsx';import {SavedAssessment} from '/src/features/intelligence/assessments.tsx';import {CalendarPage} from '/src/pages/Calendar.tsx';import {createSeed} from '/src/lib/model.ts';
window.compareRow=undefined;window.pending=[];window.listeners=new Set();window.queries=[];window.blank={assessment:null,applicable:false,sourceUntil:null};window.rows={};window.historyRows={page:[],isDone:true,continueCursor:''};window.availability={status:'ready',guidance:'Synthetic ready'};window.recovery={aborted:false,positions:[{position:0,stage:"confirmed",errorCode:null,notBefore:null},{position:1,stage:"unknown",errorCode:null,notBefore:null}]};
const seed=createSeed(),ws=seed.activeWorkspaceId;
const account={...seed.accounts.find(a=>a.channel==='X' && a.workspaceId===ws),connection:'connected',capability:{maxText:280,maxThread:100,maxMedia:4,mediaTypes:['image'],publish:false},xEvidence:{scopes:['tweet.write','tweet.read','users.read','media.write'],identityVerifiedAt:1,connectionSequence:1,textScopeEligible:true,mediaScopeEligible:true,liveWrite:'unverified'}};
const asset={id:'media',workspaceId:ws,name:'Approved image',alt:'Changed library default',type:'image',size:70,status:'ready',origin:'R2',url:'',mime:'image/png'};
const draft={id:'thread',workspaceId:ws,title:'Exact approved thread',accountId:account.id,pillar:'',strategy:'generic',comments:[],revision:1,versions:[{id:'version-one',number:1,text:['Exact approved first','Exact approved second'],mediaIds:[],media:[],createdAt:new Date().toISOString(),reason:'Fixture'}]};
const command=(kind,args)=>new Promise(resolve=>window.pending.push({kind,args,resolve}));
const no=()=>false;
window.store={state:{...seed,role:'Owner',accounts:[account],media:[],drafts:[draft],schedules:[]},approveFirstWrite:d=>command('approve',{versionId:d.versions.at(-1).id,accountId:d.accountId}),confirmFirstWrite:(d,id)=>command('confirm',{versionId:d.versions.at(-1).id,accountId:d.accountId,approvalId:id}),saveDraft:d=>command('save',d),approveVersion:async()=>false,revokeApproval:async()=>false,cancelSchedule:s=>command('cancel',{scheduleId:s.id,expectedGeneration:s.generation}),replaceSchedule:async()=>false,createDraft:async()=>'',loadMoreVersions:no,hasMoreVersions:false,loadMoreMedia:no,hasMoreMedia:false,members:[],mutate:no,addComment:async()=>false,resolveComment:async()=>false,assignDraft:async()=>false};
window.update=(fn)=>{window.store.state=fn(window.store.state);window.listeners.forEach(cb=>cb());};
const root=ReactDOM.createRoot(document.getElementById('root')),router=createMemoryRouter([{path:'/calibration-assessment',element:React.createElement(SavedAssessment,{draftId:'projection-single',accountId:account.id,version:{id:'projection-version',number:1,text:['Synthetic saved independent single text question?'],mediaIds:[],media:[],createdAt:new Date().toISOString(),reason:'Synthetic fixture'},dirty:false,conflict:false,saving:false})},{path:'/drafts/:id',element:React.createElement(ComposerPage)},{path:'/calendar',element:React.createElement(CalendarPage)}],{initialEntries:['/drafts/thread']});
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
    path: `${artifactDir}/task28.3-composer-result.png`,
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
  await page.screenshot({
    path: `${artifactDir}/task28.3-composer.png`,
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("tab", { name: "Intelligence", exact: true }).click();
  // Real recommendation component and actual registered API names; deterministic transport fixture only.
  const before = {
    title: "Exact approved thread",
    accountId: "fixture",
    pillar: "",
    strategy: "generic",
    text: ["Exact approved first", "Exact approved second"],
    media: [{ assetId: "image-fixture", alt: "Human existing alt" }],
  };
  const after = {
    ...before,
    text: ["Exact edited first", "Exact approved second"],
  };
  const proposals = {
    assessmentId: "assessment-one",
    revision: 1,
    proof: "exact-proof-one",
    ruleVersion: "editorial-edits-v1",
    candidates: [
      { kind: "duplicate", segment: 0, start: 2, end: 5 },
      {
        kind: "tokens",
        segment: 1,
        tokens: [
          { start: 0, end: 4, text: "#one", kind: "hashtag" },
          { start: 5, end: 9, text: "#two", kind: "hashtag" },
          { start: 10, end: 16, text: "#three", kind: "hashtag" },
          { start: 17, end: 22, text: "#four", kind: "hashtag" },
        ],
      },
    ],
  };
  await page.evaluate(
    ({ r, p, b, a }) => {
      window.rows["version-one"] = {
        assessment: r,
        applicable: true,
        sourceUntil: null,
        recommendations: p,
      };
      window.compareRow = { before: b, after: a };
      window.update((s) => ({
        ...s,
        media: [
          {
            id: "image-fixture",
            workspaceId: s.activeWorkspaceId,
            name: "Approved fixture image",
            type: "image",
            alt: "Human existing alt",
            status: "ready",
            size: 70,
            origin: "R2",
            url: "",
          },
        ],
      }));
      window.listeners.forEach((cb) => cb());
    },
    { r: assessment, p: proposals, b: before, a: after },
  );
  const input = page.locator("textarea").first();
  await expect(input).toHaveValue("Exact approved first");
  await page
    .getByRole("button", { name: "Änderung auswählen 1", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Vollständigen Vergleich öffnen",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Segment 2", { exact: true })).toHaveCount(2);
  await expect(
    dialog.getByText("Alt: Human existing alt", { exact: true }),
  ).toHaveCount(2);
  await expect(
    dialog.getByText("Bild / Medium 1 · Approved fixture image", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expect(
    dialog.getByText("Exact edited first", { exact: true }),
  ).toBeVisible();
  const accept = dialog.getByRole("button", {
    name: "Als neue Version übernehmen",
    exact: true,
  });
  await expect(accept).toBeEnabled();
  await accept.click();
  await expect(
    dialog.getByRole("button", { name: "Übernahme wird bestätigt …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending.length)).toBe(1);
  expect(await page.evaluate(() => window.pending[0].name)).toBe(
    "intelligence/recommendations:adopt",
  );
  await expect(dialog).toBeVisible();
  await page.evaluate(() =>
    window.pending[0].reject(new Error("uncertain fixture")),
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "Übernahme nicht bestätigt",
  );
  await expect(dialog).toBeVisible();
  await accept.click();
  expect(
    await page.evaluate(
      () =>
        window.pending[0].args.operationKey ===
        window.pending[1].args.operationKey,
    ),
  ).toBe(true);
  // Typing while an adoption is pending remains usable. A late ACK must not replace it.
  await input.fill("New typing while adoption is pending");
  await expect(input).toHaveValue("New typing while adoption is pending");
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
            text: ["Exact edited first", "Exact approved second"],
          },
        ],
      })),
    }));
    window.pending[1].resolve({ versionId: "version-two", revision: 2 });
  });
  await expect(input).toHaveValue("New typing while adoption is pending");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Änderung auswählen 2", exact: true }),
  ).toHaveCount(0);
  // Reset to a clean scope to verify fixed comparison under typing, current proof and minimum.
  await page.reload();
  await page.getByRole("tab", { name: "Intelligence", exact: true }).click();
  await page.evaluate(
    ({ r, p, b, a }) => {
      window.rows["version-one"] = {
        assessment: r,
        applicable: true,
        sourceUntil: null,
        recommendations: p,
      };
      window.compareRow = { before: b, after: a };
      window.update((s) => ({
        ...s,
        media: [
          {
            id: "image-fixture",
            workspaceId: s.activeWorkspaceId,
            name: "Approved fixture image",
            type: "image",
            alt: "Human existing alt",
            status: "ready",
            size: 70,
            origin: "R2",
            url: "",
          },
        ],
      }));
      window.listeners.forEach((cb) => cb());
    },
    { r: assessment, p: proposals, b: before, a: after },
  );
  await page
    .getByRole("button", { name: "Änderung auswählen 2", exact: true })
    .click();
  await page.getByLabel("#four", { exact: true }).check();
  await page
    .getByRole("button", {
      name: "Vollständigen Vergleich öffnen",
      exact: true,
    })
    .click();
  await expect(accept).toBeEnabled();
  // Nonmodal review leaves the editor usable and final guards follow its buffer.
  await input.fill("Dirty buffer during frozen review");
  await expect(accept).toBeDisabled();
  await expect(
    dialog.getByText("Exact edited first", { exact: true }),
  ).toBeVisible();
  await input.fill("Exact approved first");
  await expect(accept).toBeEnabled();
  await page.evaluate(() => {
    window.compareRow = {
      before: {
        ...window.compareRow.before,
        text: ["Unexpected changed input"],
      },
      after: {
        ...window.compareRow.after,
        text: ["Unexpected changed output"],
      },
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(
    dialog.getByText("Exact edited first", { exact: true }),
  ).toBeVisible();
  await expect(accept).toBeDisabled();
  await page.screenshot({
    path: `${artifactDir}/task29-composer-frozen-diff.png`,
    animations: "disabled",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Vergleich schließen", exact: true })
    .click();
  // No automatic analysis on rapid typing, and editing remains usable.
  await input.fill("Rapid typing 1");
  await input.fill("Rapid typing 12");
  await input.fill("Rapid typing 123");
  expect(await page.evaluate(() => window.pending.length)).toBe(0);
  await expect(input).toHaveValue("Rapid typing 123");
  await expect(
    page.getByRole("button", {
      name: "Gespeicherte Version analysieren",
      exact: true,
    }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.update((s) => ({
      ...s,
      drafts: s.drafts.map((d) => ({
        ...d,
        id: "short",
        revision: 1,
        versions: [
          { ...d.versions[0], id: "short-version", number: 1, text: ["short"] },
        ],
      })),
    })),
  );
  await page.evaluate(() => window.router.navigate("/drafts/short"));
  await page.getByRole("tab", { name: "Intelligence", exact: true }).click();
  await expect(
    page.getByText("Analyse ab 20 Zeichen ohne Leerraum", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Gespeicherte Version analysieren",
      exact: true,
    }),
  ).toBeDisabled();
  // Missing aggregate/low confidence remain explicit; no Audience Fit invented.
  await page.reload();
  await page.getByRole("tab", { name: "Intelligence", exact: true }).click();
  await page.evaluate((r) => {
    const low = {
      ...r,
      result: {
        ...r.result,
        outcome: "low_confidence",
        score: {
          ...r.result.score,
          aggregate: null,
          missing: ["clarity"],
          lowConfidence: ["hookStrength"],
        },
      },
    };
    window.rows["version-one"] = {
      assessment: low,
      applicable: true,
      sourceUntil: null,
      recommendations: null,
    };
    window.listeners.forEach((cb) => cb());
  }, assessment);
  await expect(page.getByText("— / 100", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Unvollständige Bewertung: Klarheit, Hook", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Audience Fit: nicht verfügbar.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Gespeicherte Version analysieren",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Veraltete / derzeit nicht anwendbare Bewertung", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("— / 100", { exact: true })).toBeVisible();
  await page.evaluate(() =>
    window.pending[0].resolve({ outcome: "provider_error", cached: false }),
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "Bewertung nicht verfügbar" }),
  ).toBeVisible();
  await expect(page.getByText("— / 100", { exact: true })).toBeVisible();
  await page.screenshot({
    path: `${artifactDir}/task29-composer-incomplete.png`,
    animations: "disabled",
    fullPage: true,
  });
  // A pending analysis cannot post success into a later account/workspace scope.
  for (const scope of ["account", "workspace"]) {
    await page.reload();
    await page.getByRole("tab", { name: "Intelligence", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Gespeicherte Version analysieren",
        exact: true,
      })
      .click();
    await page.evaluate((kind) => {
      window.rows = {};
      window.update((s) =>
        kind === "account"
          ? {
              ...s,
              accounts: s.accounts.map((a) => ({ ...a, id: "account-other" })),
              drafts: s.drafts.map((d) => ({
                ...d,
                accountId: "account-other",
              })),
            }
          : {
              ...s,
              activeWorkspaceId: "workspace-other",
              accounts: s.accounts.map((a) => ({
                ...a,
                workspaceId: "workspace-other",
              })),
              drafts: s.drafts.map((d) => ({
                ...d,
                workspaceId: "workspace-other",
              })),
            },
      );
      window.pending[0].resolve({ outcome: "success", cached: false });
    }, scope);
    await expect(
      page.getByText("Bewertung gespeichert.", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("65 / 100", { exact: true })).toHaveCount(0);
  }
  mkdirSync(`${artifactDir}/dispatch-task43.3-evidence/browser`, {
    recursive: true,
  });
  await page.clock.install();
  await page.evaluate((r) => {
    window.historyRows = { page: [], isDone: true, continueCursor: "" };
    window.rows["projection-version"] = {
      assessment: {
        ...r,
        draftId: "projection-single",
        draftVersionId: "projection-version",
      },
      applicable: true,
      sourceUntil: null,
      projection: {
        version: "prospective-calibration-v1",
        state: "candidate",
        score: 66.8,
        reason: null,
        formulaVersion: "dispatch-score-v1",
        thresholdVersion: "jev-confidence-startup-v1",
        proofUntil: Date.now() + 20000,
        operatingUntil: Date.now() + 10000,
        pin: null,
      },
    };
    window.availability = { status: "ready", guidance: "Synthetic ready" };
    window.router.navigate("/calibration-assessment");
    window.listeners.forEach((cb) => cb());
  }, assessment);
  await expect(page.getByText("65 / 100", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Befristeter lokaler Kandidat: 66.8 / 100", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("ein gemessener Kontrollblock, kein laufender Driftbeleg.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: `${artifactDir}/dispatch-task43.3-evidence/browser/assessment-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({
    path: `${artifactDir}/dispatch-task43.3-evidence/browser/assessment-mobile.png`,
    fullPage: true,
  });
  await page.clock.runFor(10001);
  await expect(
    page.getByText("Befristeter lokaler Kandidat: 66.8 / 100", {
      exact: false,
    }),
  ).toHaveCount(0);
  await expect(page.getByText("65 / 100", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.rows["projection-version"] = {
      ...window.rows["projection-version"],
      projection: {
        ...window.rows["projection-version"].projection,
        state: "static",
        score: 65,
        reason: "CALIBRATION_OWNER_ACTIVATION_REQUIRED",
        operatingUntil: null,
        proofUntil: null,
      },
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(
    page.getByText("Statische Formel: 65.0 / 100", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("65 / 100", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Actual styled Composer TASK29: production analysis, default-OFF, saved ID/no text mutation, awaited failure/retry, dirty/role/version guards, historical expiry/withdrawal; whole-thread/media frozen diff, explicit individually awaited adoption, stable operation retry, late ACK preserves typing, sibling invalidation, changed comparison guard, minimum, rapid typing/no calls, low/missing/running/provider error retained PASS. Transport mocked; no live auth/model/manual acceptance.",
  );
} finally {
  await browser?.close();
  await server.close();
}
