import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtempSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
mkdirSync(`${artifactDir}/dispatch-task46.2-evidence/browser-pixels`, {
  recursive: true,
});
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const n=getFunctionName(ref);window.queries.push({n,args});if(n==='planning/plans:context')return window.context;if(n==='planning/plans:list')return window.plans;if(n==='planning/plans:get')return window.detail;if(n==='planning/strategy:get')return window.series;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({n:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const backendConfigured=true;export const AuthBoundary=({children})=>children;export const authClient={useSession:()=>({data:window.session,isPending:false}),signOut:async()=>({})};export {authPath,returnPath} from '/src/lib/navigation.ts';`,
  "@/lib/store": `import {useState} from 'react';export const WorkspaceStoreProvider=({children})=>children;export const useLocalState=(k,i)=>useState(i);export const useWorkspaceLocalState=useLocalState;export const useStore=()=>({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,preferences:{timezone:'UTC',name:'Synthetic'},workspaces:[{id:window.workspace,name:'Synthetic Workspace'}],schedules:[],accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[]},setState:()=>{},selectWorkspace:async()=>true,selectAccount:()=>{},createDraft:()=>{throw new Error('No live seed draft');},mutate:()=>{throw new Error('Demo mutation reached live');}});`,
};
const entry = `import {ConvexError} from 'convex/values';window.nativeConvexError=ConvexError;import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AppShell} from '/src/App.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import {PlansPage} from '/src/pages/Plans.tsx';import '/src/index.css';window.path='/plans';window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.queries=[];window.commands=[];window.context={preferenceId:'preference-one',timezone:'Europe/Berlin'};window.plans=[];window.detail=undefined;window.series={control:null,version:null,reason:null,candidates:[{versionId:'version-one',title:'Exact theme material',sourceUntil:Date.now()+3600000}],pillars:[{name:'Product',weight:60},{name:'Engineering',weight:40}],styleUntil:null,selectedStyleVersionId:'style-one'};const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{key:window.path,initialEntries:[window.path]},React.createElement(TooltipProvider,null,React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(AppShell)},React.createElement(Route,{path:'plans',element:React.createElement(PlansPage)}),React.createElement(Route,{path:'*',element:React.createElement('p',{'data-testid':'route-marker'},'Native outlet marker')})))))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/finite-series-fixture-vite`,
  server: { host: "127.0.0.1", port: 5175, strictPort: true },
  plugins: [
    {
      name: "planning-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0planning-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/planning-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__planning-entry"></script>',
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
  await page.goto("http://127.0.0.1:5175/planning-fixture");
  const activate = page.getByRole("button", {
    name: "Endliche Vorschlagsserie aktivieren",
    exact: true,
  });
  await expect(activate).toBeVisible();
  await expect(
    page.getByText("Serie aus · Revision 0", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  await activate.click();
  await expect(page.getByRole("alert")).toContainText("ausdrücklich");
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  await page
    .getByLabel("Serienthema", { exact: true })
    .fill("Product research");
  await page.getByLabel("Gewünschtes Format (unbelegt)").selectOption("single");
  await page.getByLabel("Deklarierte Cosinusgrenze").fill("0.91");
  await page.getByLabel("Serien-IANA-Zeitzone").fill("Europe/Berlin");
  await page.getByLabel("Serienfrequenz").selectOption("weekly");
  await page.getByLabel("Callback-Wochentag").selectOption("3");
  await page.getByLabel("Lokale Vorschlagsuhrzeit").fill("09:00");
  await page
    .getByLabel("Lokale Publishing-Fenster (HH:mm, mit Komma)")
    .fill("10:00, 11:00, 12:00");
  await page.getByLabel("Serienstart (einschließlich)").fill("2026-10-14");
  await page.getByLabel("Serienende (einschließlich)").fill("2026-11-10");
  await page.getByLabel("Anzahl Batches (1–4)").fill("4");
  await page.getByLabel("Slots je Batch (1–7)").fill("3");
  await page.getByLabel("Historienrahmen ab (UTC)").fill("2026-10-01T00:00");
  await page.getByLabel("Historienrahmen bis (UTC)").fill("2026-10-06T08:00");
  // Checkbox click order is not pillar identity/order: actual selected style order controls the emitted weighted subset.
  await page.getByLabel("Engineering · Gewicht 40").check();
  await page.getByLabel("Product · Gewicht 60").check();
  await page.getByLabel("Product · Gewicht 60").uncheck();
  await page.getByLabel("Product · Gewicht 60").check();
  await page.getByLabel("Exact theme material · version-one").check();
  await activate.click();
  await expect(page.getByLabel("Serienthema", { exact: true })).toBeDisabled();
  const first = await page.evaluate(() => window.commands[0].args);
  expect(first.accountId).toBe("account-one");
  expect(first.workspaceId).toBe("workspace-one");
  expect(first.action.config.candidateVersionIds).toEqual(["version-one"]);
  expect(first.action.config.pillars).toEqual([
    { name: "Product", weight: 60 },
    { name: "Engineering", weight: 40 },
  ]);
  expect(first.action.config.styleVersionId).toBe("style-one");
  expect(first.action.config.threshold).toBe(0.91);
  expect(first.action.config.publishingClocks).toEqual([
    "10:00",
    "11:00",
    "12:00",
  ]);
  await page.evaluate(() => {
    window.series.control = {
      _id: "series-one",
      revision: 1,
      enabled: true,
      remaining: 4,
      nextAt: Date.now() + 10000,
    };
    window.commands[0].reject(new Error("Lost response"));
    window.render();
  });
  await expect(page.getByRole("alert")).toContainText("derselbe Auftrag");
  await expect(page.getByLabel("Serienthema", { exact: true })).toHaveValue(
    "Product research",
  );
  await activate.click();
  const retry = await page.evaluate(() => window.commands[1].args);
  expect(retry.commandKey).toBe(first.commandKey);
  expect(retry.expectedRevision).toBe(0);
  expect(retry).toEqual(first);
  await page.evaluate(() =>
    window.commands[1].resolve({
      seriesId: "series-one",
      revision: 1,
      versionId: "series-version-one",
      receiptId: "series-receipt-one",
    }),
  );
  await expect(
    page.getByText("Endliche Serie gespeichert.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Serie deaktivieren", exact: true })
    .click();
  expect((await page.evaluate(() => window.commands[2].args)).action).toEqual({
    kind: "disable",
  });
  await page.evaluate(() => {
    window.commands[2].resolve({
      seriesId: "series-one",
      revision: 2,
      versionId: null,
      receiptId: "disable",
    });
    window.series.control = {
      ...window.series.control,
      revision: 2,
      enabled: false,
      remaining: 0,
      nextAt: null,
    };
    window.render();
  });
  await expect(
    page.getByText("Angenommene Termine bleiben erhalten.", { exact: false }),
  ).toBeVisible();
  // A definitive CAS rejection requires an explicit review; it never changes a command automatically.
  await activate.click();
  const conflicted = await page.evaluate(() => window.commands[3].args);
  expect(conflicted.expectedRevision).toBe(2);
  await page.evaluate(() => {
    window.commands[3].reject(
      new window.nativeConvexError("SERIES_REVISION_CONFLICT"),
    );
    window.series.control = { ...window.series.control, revision: 3 };
    window.render();
  });
  await expect(page.getByRole("alert")).toContainText("Revision geändert");
  await expect(activate).toBeDisabled();
  await expect(page.getByLabel("Serienthema", { exact: true })).toHaveValue(
    "Product research",
  );
  const review = page.getByRole("button", {
    name: "Aktuelle Revision 3 prüfen und neuen Auftrag vorbereiten",
    exact: true,
  });
  await expect(review).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(4);
  await review.click();
  expect(await page.evaluate(() => window.commands.length)).toBe(4);
  await expect(activate).toBeEnabled();
  await activate.click();
  const reviewed = await page.evaluate(() => window.commands[4].args);
  expect(reviewed.expectedRevision).toBe(3);
  expect(reviewed.commandKey).not.toBe(conflicted.commandKey);
  expect(reviewed.action).toEqual(conflicted.action);
  expect(reviewed.seriesId).toBe("series-one");
  await page.evaluate(() => {
    window.commands[4].resolve({
      seriesId: "series-one",
      revision: 4,
      versionId: "reviewed-version",
      receiptId: "reviewed-receipt",
    });
    window.series.control = {
      ...window.series.control,
      revision: 4,
      enabled: true,
    };
    window.render();
  });
  await expect(
    page.getByText("Endliche Serie gespeichert.", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page
    .getByText("Wiederkehrende Serien", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${artifactDir}/dispatch-task46.2-evidence/browser-pixels/series-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByText("Wiederkehrende Serien", { exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${artifactDir}/dispatch-task46.2-evidence/browser-pixels/series-mobile.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(activate).toBeDisabled();
  await page.evaluate(() => {
    window.account = "account-two";
    window.render();
  });
  await expect(page.getByLabel("Serienthema", { exact: true })).toHaveValue("");
  expect(
    (
      await page.evaluate(() =>
        window.queries.filter((q) => q.n === "planning/strategy:get").at(-1),
      )
    ).args.accountId,
  ).toBe("account-two");
  await page.evaluate(() => {
    window.role = "Owner";
    window.series.version = {
      _id: "version-expiring",
      sourceUnavailable: false,
      sourceUntil: Date.now() + 300,
      config: { theme: "Ephemeral protected theme", desiredFormat: "single" },
    };
    window.series.candidates = [
      {
        versionId: "expired-candidate",
        title: "Ephemeral candidate",
        sourceUntil: Date.now() + 300,
      },
    ];
    window.series.pillars = [{ name: "Ephemeral pillar", weight: 100 }];
    window.series.styleUntil = Date.now() + 300;
    window.render();
  });
  await expect(
    page.getByText("Thema: Ephemeral protected theme", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Serieninhalt nicht mehr lesbar", { exact: false }),
  ).toBeVisible({ timeout: 3000 });
  await expect(
    page.getByText("Ephemeral protected theme", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ephemeral candidate", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Ephemeral pillar", { exact: false }),
  ).toHaveCount(0);
  await page.goto("http://127.0.0.1:5175/planning-fixture?demo=1");
  await expect(activate).toHaveCount(0);
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  expect(errors).toEqual([]);
  console.log(
    "Finite actual styled Plans PASS: default OFF/zero IO, explicit exact intent, canonical multi-pillar subset, pending/error/dirty/exact lost-response replay, explicit reviewed CAS recovery, disable, desktop/390px, Viewer/account scope, elapsed semantic/style/content expiry, Demo separation. Transport/auth mocked; no live/manual acceptance.",
  );
} finally {
  await browser?.close();
  await server.close();
}
