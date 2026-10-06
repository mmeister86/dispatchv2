import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, ""),
  evidence = "/tmp/dispatch-task46.1-evidence";
mkdirSync(evidence, { recursive: true });
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='content/similarity:availability')return window.availability;if(name==='content/similarity:frame')return window.frame;if(name==='performance/history:overview')return {posts:[],jobs:[],policy:null,reason:null,maxResults:null};};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const authClient={};`,
  "@/lib/store": `import {useState} from 'react';export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>({state:window.state,members:[],mutate:()=>false,saveDraft:async()=>false,loadMoreVersions:()=>{},loadMoreDrafts:()=>{},resourcesLimited:false,hasMoreVersions:false,hasMoreDrafts:false,hasMoreMedia:false,events:[],notifications:[],setState:()=>false});`,
};
const entry = `import '/src/index.css';import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,createMemoryRouter,RouterProvider} from 'react-router-dom';import {Similarity} from '/src/features/content/Similarity.tsx';import {ComposerPage} from '/src/pages/Drafts.tsx';import {AnalyticsPage} from '/src/pages/Analytics.tsx';import {createSeed} from '/src/lib/model.ts';window.state=createSeed();window.state.activeWorkspaceId=window.state.workspaces[0].id;window.state.role='Owner';window.account=window.state.accounts.find(a=>a.workspaceId===window.state.activeWorkspaceId).id;window.version='synthetic-version-one';window.blocked=false;const comparison=window.state.drafts.find(d=>d.workspaceId===window.state.activeWorkspaceId);window.state.drafts.push({...comparison,id:'synthetic-comparison-draft',title:'Exakter Vergleichsentwurf B',versions:[{...comparison.versions.at(-1),id:'synthetic-comparison-version'}]});window.availability={enabled:false,sendConfigured:true,storedEnabled:false,generation:0,policyId:null,controlPolicyId:null,reason:'EMBEDDING_CONFIGURATION_REQUIRED',expiresAt:null,identity:null};window.frame=undefined;window.queries=[];window.commands=[];window.sequence=0;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>{const surface=new URLSearchParams(location.search).get('surface');let element;if(surface==='draft'){const draft=window.state.drafts.find(d=>d.workspaceId===window.state.activeWorkspaceId);draft.versions.at(-1).id=window.version;window.nativeRouter??=createMemoryRouter([{path:'/drafts/:id',element:React.createElement(ComposerPage)}],{initialEntries:['/drafts/'+draft.id]});element=React.createElement(RouterProvider,{router:window.nativeRouter});}else if(surface==='analytics')element=React.createElement(MemoryRouter,null,React.createElement(AnalyticsPage));else element=React.createElement(Similarity,{accountId:window.account,versionId:window.version,blocked:window.blocked});root.render(React.createElement(React.StrictMode,null,React.createElement('div',{className:'page', 'data-sequence':window.sequence++},element)));};window.render();`;
const server = await createServer({
  root,
  configFile: root + "/vite.config.ts",
  cacheDir: "/tmp/dispatch-semantic-vite",
  server: { host: "127.0.0.1", port: 5180, strictPort: true },
  plugins: [
    {
      name: "semantic-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(root + "/src/lib/store"))
          return "\0fixture:@/lib/store";
        if (id.startsWith(root + "/src/lib/auth-client"))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id === "\0semantic-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/semantic-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__semantic-entry"></script>',
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
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5180/semantic-fixture");
  await expect(
    page.getByText("Konfiguration erforderlich:", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  await page.getByLabel("Semantische Historie von").fill("2026-09-01");
  await page.getByLabel("Semantische Historie bis").fill("2026-10-06");
  await page.evaluate(() => {
    window.availability = {
      ...window.availability,
      policyId: "synthetic-policy",
      expiresAt: Date.now() + 86400000,
      identity: {
        resolvedModel: "synthetic/embedding",
        dimension: 3,
        assembly: "own-text-v1",
        normalization: "cosine-float-v1",
      },
    };
    window.render();
  });
  await expect(
    page.getByText("Modell: synthetic/embedding", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Policy bis", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  await page.evaluate(() => {
    window.availability = {
      ...window.availability,
      enabled: true,
      storedEnabled: true,
      generation: 1,
      policyId: "synthetic-policy",
      controlPolicyId: "synthetic-policy",
      expiresAt: Date.now() + 86400000,
      identity: {
        resolvedModel: "synthetic/embedding",
        dimension: 3,
        assembly: "own-text-v1",
        normalization: "cosine-float-v1",
      },
    };
    window.frame = {
      reason: "EMBEDDING_QUERY_UNAVAILABLE",
      overflow: false,
      complete: false,
      partial: true,
      scanned: 1,
      eligible: 1,
      prepared: 0,
      missing: 1,
      unavailable: 0,
      sourceUntil: Date.now() + 86400000,
      identity: window.availability.identity,
      items: [],
      matches: [],
    };
    window.render();
  });
  await page
    .getByRole("button", { name: "Ausgewählte Quelle indexieren" })
    .click();
  await expect(
    page.getByRole("button", { name: "Wird vorbereitet…" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands.length)).toBe(1);
  await page.evaluate(() => window.commands[0].resolve("synthetic-attempt"));
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(2);
  await page.evaluate(() =>
    window.commands[1].reject(new Error("Synthetic sanitized error")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Synthetic sanitized error",
  );
  await page
    .getByRole("button", { name: "Exakten Auftrag erneut prüfen" })
    .click();
  expect(await page.evaluate(() => window.commands.length)).toBe(3);
  expect(await page.evaluate(() => window.commands[2].args.attemptId)).toBe(
    "synthetic-attempt",
  );
  await page.evaluate(() =>
    window.commands[2].resolve({
      outcome: "prepared",
      vectorId: "synthetic-vector",
    }),
  );
  await expect(
    page.getByRole("status").filter({ hasText: "Vektor vorbereitet" }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.frame = {
      ...window.frame,
      reason: "EMBEDDING_PARTIAL_COVERAGE",
      scanned: 3,
      eligible: 3,
      prepared: 2,
      missing: 1,
      matches: [
        {
          source: { kind: "history", historyPostId: "synthetic-history" },
          pin: { kind: "history", externalId: "123" },
          vectorId: "match-vector",
          score: 0.98,
          text: "Synthetic retained own post",
          sourceUntil: Date.now() + 3600000,
        },
      ],
    };
    window.render();
  });
  await expect(page.getByText("Synthetic retained own post")).toBeVisible();
  await expect(
    page.getByText("Fehlende Vektoren sind keine Neuartigkeitsgarantie.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toHaveCount(1);
  await page.screenshot({
    path: evidence + "/semantic-390.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.frame = {
      ...window.frame,
      overflow: true,
      complete: false,
      matches: [],
    };
    window.render();
  });
  await expect(page.getByRole("alert")).toContainText("Rahmen zu groß");
  // Stored consent can be withdrawn while current account/funding authority is blocked.
  await page.evaluate(() => {
    window.availability = {
      ...window.availability,
      enabled: false,
      storedEnabled: true,
      policyId: null,
      reason: "EMBEDDING_ACCOUNT_CHANGED",
    };
    window.render();
  });
  await page.getByRole("button", { name: "Zweck widerrufen" }).click();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toMatchObject({
    enabled: false,
    policyId: "synthetic-policy",
    expectedGeneration: 1,
  });
  await page.evaluate(() => window.commands.at(-1).resolve(2));
  await page.evaluate(() => {
    window.availability = {
      ...window.availability,
      enabled: true,
      storedEnabled: true,
      generation: 2,
      policyId: "synthetic-policy",
    };
    window.frame = undefined;
    window.render();
  });
  await page
    .getByRole("button", { name: "Ausgewählte Quelle indexieren" })
    .click();
  await page.evaluate(() =>
    window.commands.at(-1).resolve("old-scope-attempt"),
  );
  await expect
    .poll(() => page.evaluate(() => window.commands.at(-1).name))
    .toBe("ai/embeddings:execute");
  await page.evaluate(() => {
    window.state.role = "Viewer";
    window.render();
  });
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ outcome: "prepared", vectorId: "obsolete" }),
  );
  await expect(
    page.getByText("Vektor vorbereitet.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ausgewählte Quelle indexieren" }),
  ).toBeDisabled();
  // Switching account remounts the scope and cannot display an old provider completion.
  await page.evaluate(() => {
    window.state.role = "Owner";
    window.render();
  });
  await page
    .getByRole("button", { name: "Ausgewählte Quelle indexieren" })
    .click();
  await page.evaluate(() =>
    window.commands.at(-1).resolve("old-account-attempt"),
  );
  await expect
    .poll(() => page.evaluate(() => window.commands.at(-1).name))
    .toBe("ai/embeddings:execute");
  await page.evaluate(() => {
    window.account = "different-account";
    window.render();
  });
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ outcome: "prepared", vectorId: "obsolete-account" }),
  );
  await expect(
    page.getByText("Vektor vorbereitet.", { exact: false }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.availability.sendConfigured = false;
    window.render();
  });
  await expect(
    page.getByText("Sendekonfiguration fehlt.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ausgewählte Quelle indexieren" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 960 });
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toHaveCount(1);
  await page.screenshot({
    path: evidence + "/semantic-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:5180/semantic-fixture?surface=draft");
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toBeVisible();
  await expect(
    page.getByText("Gleicher Themenbereich.", { exact: false }),
  ).toHaveCount(0);
  await page.getByLabel("Semantische Historie von").fill("2026-09-01");
  await page.getByLabel("Semantische Historie bis").fill("2026-10-06");
  await page
    .getByLabel("Semantische Quelle")
    .selectOption("draft:synthetic-comparison-version");
  const comparisonArgs = await page.evaluate(
    () =>
      window.queries.filter((q) => q.name === "content/similarity:frame").at(-1)
        .args,
  );
  expect(comparisonArgs.source).toEqual({
    kind: "draft",
    draftVersionId: "synthetic-comparison-version",
  });
  expect(comparisonArgs.candidateVersionIds).toEqual([
    "synthetic-version-one",
    "synthetic-comparison-version",
  ]);
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toHaveCount(1);
  await page.screenshot({ path: evidence + "/draft-390.png", fullPage: true });
  await page.goto("http://127.0.0.1:5180/semantic-fixture?surface=analytics");
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toHaveCount(1);
  await page.goto(
    "http://127.0.0.1:5180/semantic-fixture?surface=analytics&demo=1",
  );
  await expect(
    page.getByRole("heading", { name: "Semantische Ähnlichkeiten" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.queries.some((q) => q.name.startsWith("content/similarity")),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync(
    evidence + "/browser-report.json",
    JSON.stringify(
      {
        status: "PASS",
        evidence:
          "Synthetic browser fixture; real styled component and Drafts/Analytics pages. No live provider or authenticated manual acceptance.",
        checks: [
          "default OFF zero calls",
          "configured exact model and policy expiry visible before forwarding consent",
          "explicit exact source index",
          "pending mutex",
          "sanitized error",
          "same attempt retry",
          "partial cosine evidence",
          "390px no overflow",
          "cap+1 overflow",
          "blocked consent withdrawal",
          "role stale-response fence",
          "account stale-response fence",
          "missing send configuration visible and blocked",
          "real Drafts insertion",
          "selected exact draft B retains A and B frame with zero automatic transport",
          "real Analytics insertion",
          "Demo separation",
        ],
      },
      null,
      2,
    ),
  );
} catch (error) {
  writeFileSync(
    evidence + "/browser-failure.txt",
    String(error.stack ?? error),
  );
  throw error;
} finally {
  await browser?.close();
  await server.close();
}
