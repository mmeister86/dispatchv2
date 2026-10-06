import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const n=getFunctionName(ref);window.queries.push({n,args});if(n==='planning/plans:context')return window.context;if(n==='planning/plans:list')return window.plans;if(n==='planning/plans:get')return window.detail;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({n:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});`,
  "@/lib/auth-client": `export const demoMode=false;export const backendConfigured=true;export const AuthBoundary=({children})=>children;export const authClient={signOut:async()=>({})};export {authPath,returnPath} from '/src/lib/navigation.ts';`,
  "@/lib/store": `import {useState} from 'react';export const WorkspaceStoreProvider=({children})=>children;export const useLocalState=(k,i)=>useState(i);export const useWorkspaceLocalState=useLocalState;export const useStore=()=>({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,preferences:{timezone:'UTC',name:'Synthetic'},workspaces:[{id:window.workspace,name:'Synthetic Workspace'}],schedules:[],accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[]},setState:()=>{},selectWorkspace:async()=>true,selectAccount:()=>{},createDraft:()=>{throw new Error('No live seed draft');},mutate:()=>{throw new Error('Demo mutation reached live');}});`,
};
const entry = `import {ConvexError} from 'convex/values';window.nativeConvexError=ConvexError;import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {AppShell} from '/src/App.tsx';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import {PlansPage} from '/src/pages/Plans.tsx';import '/src/index.css';window.path='/plans';window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.queries=[];window.commands=[];window.context={preferenceId:'preference-one',timezone:'Europe/Berlin'};window.plans=[];window.detail=undefined;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{key:window.path,initialEntries:[window.path]},React.createElement(TooltipProvider,null,React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(AppShell)},React.createElement(Route,{path:'plans',element:React.createElement(PlansPage)}),React.createElement(Route,{path:'*',element:React.createElement('p',{'data-testid':'route-marker'},'Native outlet marker')})))))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/planning-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
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
  await page.goto("http://127.0.0.1:5174/planning-fixture");
  await page.screenshot({
    path: "/tmp/dispatch-task24-evidence/plans-shell-pre.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Planvorschläge erstellen", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Themenschwerpunkt").fill("Dirty topic");
  await page
    .getByRole("button", { name: "Planvorschläge erstellen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Vorschläge werden erstellt" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.commands[0].reject(new window.nativeConvexError("SLOT_SCAN_LIMIT"));
  });
  await expect(page.getByRole("alert")).toContainText("Suchgrenze erreicht");
  await expect(page.getByLabel("Themenschwerpunkt")).toHaveValue("Dirty topic");
  await page
    .getByRole("button", { name: "Planvorschläge erstellen", exact: true })
    .click();
  await page.evaluate(() => {
    window.commands[1].reject(
      new window.nativeConvexError("VERSION_PROPOSAL_LIMIT"),
    );
  });
  await expect(page.getByRole("alert")).toContainText(
    "Vorschlagsgrenze für diese Version erreicht",
  );
  await expect(page.getByLabel("Themenschwerpunkt")).toHaveValue("Dirty topic");
  await page
    .getByRole("button", { name: "Planvorschläge erstellen", exact: true })
    .click();
  await page.evaluate(() => {
    window.plans = [
      {
        _id: "plan-one",
        desiredCount: 3,
        selectedCount: 0,
        createdAt: Date.now(),
        coveragePartial: true,
        shortages: [
          { code: "UNVERIFIED_LINEAGE", count: 1 },
          { code: "VERSION_PROPOSAL_LIMIT", count: 1 },
        ],
        historyContext: {
          available: 1,
          scanned: 2,
          unavailable: 1,
          partial: false,
        },
        start: "2026-10-07",
        end: "2026-10-13",
      },
    ];
    window.detail = { plan: window.plans[0], items: [] };
    window.commands[2].resolve("plan-one");
    window.render();
  });
  await expect(page.getByRole("button", { name: /0 von 3/ })).toBeVisible();
  await expect(page.getByText(/Keine passenden Entwürfe/)).toBeVisible();
  await expect(page.getByText(/Ausschnitt/)).toBeVisible();
  await expect(
    page.getByText(
      /Vorschlagsgrenze für diese Version erreicht · neue Entwurfsversion erforderlich/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Bei Erstellung: 1 von 2 früheren Terminen nutzbar/),
  ).toBeVisible();
  await page.evaluate(() => {
    const now = Date.now();
    window.detail = {
      plan: { ...window.plans[0], selectedCount: 1 },
      items: [
        {
          item: {
            _id: "item-one",
            draftId: "draft-one",
            versionId: "version-one",
            versionNumber: 1,
            at: now + 60000,
            timezone: "Europe/Berlin",
            localTime: "2026-10-07T10:00",
            proofUntil: now + 60000,
            validityUntil: now + 60000,
            sources: [
              {
                repositoryId: "repo-one",
                signalId: "signal-one",
                generation: 1,
              },
            ],
            historyVersionIds: ["historical-version-one"],
            contextProofUntil: now + 1300,
            reason: "Actual pinned reason",
            status: "proposed",
          },
          title: "Pinned actual draft",
          text: ["Current readable text"],
          state: "proposed",
          displayUntil: now + 1300,
        },
      ],
    };
    window.render();
  });
  await expect(page.getByText("Pinned actual draft")).toBeVisible();
  await page.screenshot({
    path: "/tmp/dispatch-task24-evidence/plans-shell-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ablehnen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Wird abgelehnt" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.workspace = "workspace-two";
    window.account = "account-two";
    window.plans = [];
    window.detail = undefined;
    window.render();
    window.commands[3].resolve(null);
  });
  await expect(page.getByText("Pinned actual draft")).toHaveCount(0);
  await page.evaluate(() => {
    window.workspace = "workspace-one";
    window.account = "account-one";
    window.plans = [
      {
        _id: "plan-one",
        desiredCount: 3,
        selectedCount: 1,
        createdAt: Date.now(),
        coveragePartial: false,
        shortages: [],
        start: "2026-10-07",
        end: "2026-10-13",
      },
    ];
    window.render();
  });
  await page.getByRole("button", { name: /1 von 3/ }).click();
  await page.evaluate(() => {
    window.detail = {
      plan: window.plans[0],
      items: [
        {
          item: {
            _id: "item-one",
            draftId: "draft-one",
            versionNumber: 1,
            versionId: "version-one",
            at: Date.now() + 60000,
            timezone: "Europe/Berlin",
            localTime: "2026-10-07T10:00",
            proofUntil: Date.now() + 60000,
            validityUntil: Date.now() + 60000,
            sources: [],
            reason: "Actual pinned reason",
            status: "proposed",
          },
          title: "Expiring draft",
          text: ["TTL protected text"],
          state: "proposed",
          displayUntil: Date.now() + 600,
        },
      ],
    };
    window.render();
  });
  await expect(page.getByText("TTL protected text")).toBeVisible();
  await expect(page.getByText("TTL protected text")).toHaveCount(0, {
    timeout: 5000,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/dispatch-task24-evidence/plans-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  for (const path of [
    "/overview",
    "/settings/profile",
    "/calendar",
    "/drafts",
    "/drafts/exact-version",
    "/ideas",
    "/signals",
    "/research",
    "/agent",
    "/analytics",
    "/media",
  ]) {
    await page.evaluate((path) => {
      window.path = path;
      window.render();
    }, path);
    await expect(page.getByTestId("route-marker")).toBeVisible();
  }
  for (const path of [
    "/team",
    "/operations",
    "/experiments",
    "/repurpose",
    "/trends",
    "/plans-invented",
  ]) {
    await page.evaluate((path) => {
      window.path = path;
      window.render();
    }, path);
    await expect(
      page.getByRole("heading", {
        name: "Dieser Bereich wird noch angebunden",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("route-marker")).toHaveCount(0);
  }
  console.log(
    "Actual AppShell gate: reviewed route Outlet markers accessible; unimplemented Team/Operations/Experiments/Repurpose/Trends and prefix collision remain guarded. Child markers are stubs; Plans child above is actual mounted source.",
  );
  expect(errors).toEqual([]);
  console.log(
    "Mounted styled live Plans: mocked transport/auth; pending/failure/dirty/scope/zero/small/expiry/mobile passed.",
  );
} finally {
  await browser?.close();
  await server.close();
}
