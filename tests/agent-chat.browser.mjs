import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtempSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useConvexAuth=()=>({isAuthenticated:true,isLoading:false});export const useConvex=()=>({});export const useAction=()=>()=>Promise.reject(new Error("No provider"));export const usePaginatedQuery=()=>({results:[],status:"Exhausted",loadMore:()=>{}});export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='ai/conversations:list')return window.list;if(name==='ai/conversations:status')return window.runs;if(name==='ai/conversations:researchStatus')return window.researchOrders;if(name==='research/profiles:get')return window.researchProfile;if(name==='research/profiles:configuration')return {currency:null,downstreamAvailable:false};if(name==='research/runs:history')return {page:[],isDone:true,continueCursor:''};if(name==='research/evidence:inbox')return {page:[],isDone:true,continueCursor:''};if(name==='planning/plans:context')return {preferenceId:'preference-one',timezone:'UTC'};if(name==='planning/plans:list')return [];if(name==='ai/jev/access:availability')return {status:'disabled',guidance:'No live model'};if(name==='ai/conversations:projection')return window.projection;if(name==='content/ideas:list')return {page:[],isDone:true,continueCursor:''};if(name==='ai/runs:recent')return [];if(name==='ai/runs:availability')return {processingApproved:false,pricingApproved:false};};const mutations=new Map();export const useMutation=ref=>{const name=getFunctionName(ref);if(!mutations.has(name))mutations.set(name,args=>name==='ai/conversations:cleanupUnavailable'?(window.cleanupRequests.push(args),Promise.resolve(null)):new Promise((resolve,reject)=>window.commands.push({name,args,resolve,reject})));return mutations.get(name);};`,
  "@convex-dev/agent/react": `export const useUIMessages=(ref,args)=>({results:args==='skip'?[]:window.messages,status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get("demo")==="1";export const backendConfigured=true;export const authClient={useSession:()=>({data:window.session,isPending:false}),signOut:async()=>{}};export const AuthBoundary=({children})=>children;`,
  "@/lib/store": `import {useState,useEffect} from 'react';export const WorkspaceStoreProvider=({children})=>children;export const useLocalState=(key,initial)=>useState(initial);export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>{const [,tick]=useState(0);useEffect(()=>{const update=()=>tick(v=>v+1);window.listeners.add(update);return()=>window.listeners.delete(update);},[]);return({state:{...window.state,activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role},selectAccount:value=>{window.account=value;window.render();},selectWorkspace:async()=>true,setState:()=>{},createDraft:()=>{},members:[],hasMoreVersions:false,hasMoreMedia:false,mutate:()=>{},saveDraft:async args=>{window.actionTargets.push({name:'save',args});return false;},approveVersion:async draft=>{window.actionTargets.push({name:'approve',accountId:draft.accountId});return false;},planVersion:async(draft,at,timezone,localTime,schedule)=>{window.actionTargets.push({name:'schedule',accountId:schedule?.accountId??draft.accountId});return false;},cancelSchedule:async()=>false});};`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router-dom';import {TooltipProvider} from '/src/components/ui/tooltip.tsx';import {AppShell} from '/src/App.tsx';import {AgentPage} from '/src/pages/Agent.tsx';import {ComposerPage} from '/src/pages/Drafts.tsx';import {RealResearch} from '/src/features/research/profile-editor.tsx';import {RealPlans} from '/src/features/plans/plans.tsx';import {ScheduleDialog} from '/src/components/ScheduleDialog.tsx';import {createSeed} from '/src/lib/model.ts';import {useStore} from '@/lib/store';import '/src/index.css';window.listeners=new Set();window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.committedRole='Owner';window.state=createSeed();window.state.workspaces=[{id:window.workspace,name:'Synthetic workspace'}];window.state.accounts=[{...window.state.accounts[0],id:'account-one',workspaceId:window.workspace,handle:'@one',capability:{publish:true,maxText:280,maxThread:10,maxMedia:4,mediaTypes:[]}},{...window.state.accounts[0],id:'account-two',workspaceId:window.workspace,handle:'@two',capability:{publish:true,maxText:280,maxThread:10,maxMedia:4,mediaTypes:[]}}];window.state.drafts=[];window.state.schedules=[];window.state.media=[];window.actionTargets=[];window.queries=[];window.commands=[];window.list={page:[],isDone:true,continueCursor:''};window.runs=[];window.researchOrders=[];window.researchProfile=null;window.cleanupRequests=[];window.messages=[];window.projection={authorized:true,proofExpiresAt:Number.MAX_SAFE_INTEGER};function ScheduleFixture(){return React.createElement(ScheduleDialog,{draft:window.state.drafts[0],schedule:window.state.schedules[0],open:true,onOpenChange:()=>{}})}function CommittedRoleMarker(){const role=useStore().state.role;React.useEffect(()=>{window.committedRole=role;});return null;}window.router=createMemoryRouter([{element:React.createElement(AppShell),children:[{path:'/agent',element:React.createElement(AgentPage)},{path:'/drafts/:id',element:React.createElement(ComposerPage)},{path:'/research',element:React.createElement(RealResearch)},{path:'/plans',element:React.createElement(RealPlans)},{path:'/calendar',element:React.createElement(ScheduleFixture)}]}],{initialEntries:['/agent'+location.search]});const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>{window.listeners.forEach(update=>update());root.render(React.createElement(React.StrictMode,null,React.createElement(TooltipProvider,null,React.createElement(CommittedRoleMarker),React.createElement(RouterProvider,{router:window.router}))));};window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/chat-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "chat-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0chat-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/chat-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__chat-entry"></script>',
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
  await page.goto("http://127.0.0.1:5174/chat-fixture");
  await expect(page.getByText("Beginne eine neue Unterhaltung.")).toBeVisible();
  await page.getByRole("button", { name: "Neue Unterhaltung" }).click();
  expect(await page.evaluate(() => window.commands.length)).toBe(1);
  await expect(
    page.getByRole("button", { name: "Neue Unterhaltung" }),
  ).toBeDisabled();
  const createKey = await page.evaluate(
    () => window.commands[0].args.operationKey,
  );
  await page.evaluate(() =>
    window.commands[0].reject(new Error("synthetic denied")),
  );
  await page.getByRole("button", { name: "Neue Unterhaltung" }).click();
  expect(await page.evaluate(() => window.commands[1].args.operationKey)).toBe(
    createKey,
  );
  await page.evaluate(() => {
    window.list = {
      page: [
        {
          conversationId: "actual-conversation",
          title: "Neue Unterhaltung",
          revision: 1,
          state: "active",
          updatedAt: 1791210000,
          turns: 0,
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.commands[1].resolve("actual-conversation");
    window.render();
  });
  const prompt = page.getByLabel("Nachricht an Agent");
  await prompt.fill("Persistent prompt buffer");
  await page.getByRole("button", { name: "Senden", exact: true }).click();
  const send = await page.evaluate(() => window.commands[2].args);
  expect(send).toMatchObject({
    workspaceId: "workspace-one",
    accountId: "account-one",
    conversationId: "actual-conversation",
    allowIdeaCreation: false,
  });
  await expect(
    page.getByRole("button", { name: "Wird bestätigt …" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.commands[2].reject(
      new Error("MODEL_PROCESSING_CONFIGURATION_REQUIRED"),
    ),
  );
  await expect(prompt).toHaveValue("Persistent prompt buffer");
  await expect(page.getByRole("alert")).toContainText("EU-Verarbeitungspfad");
  await page.getByRole("button", { name: "Senden", exact: true }).click();
  expect(await page.evaluate(() => window.commands[3].args.operationKey)).toBe(
    send.operationKey,
  );
  await page.evaluate(() => {
    window.commands[3].resolve("actual-run");
    window.messages = [
      {
        key: "saved-user",
        role: "user",
        text: "Persistent prompt buffer",
        status: "success",
        parts: [],
      },
    ];
    window.runs = [
      {
        operationId: "actual-operation",
        runId: "actual-run",
        state: "running",
        errorCode: null,
        promptVersion: "chat-v1",
        policyVersion: "synthetic-v1",
        model: "synthetic/model",
        currency: "USD",
        inputTokens: null,
        outputTokens: null,
        estimatedMicros: null,
        heldMicros: 8100,
        usagePending: true,
        operationUsagePending: true,
        resultIdeaId: null,
      },
    ];
    window.render();
  });
  await expect(prompt).toHaveValue("");
  await expect(
    page.getByText("Persistent prompt buffer", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Anhalten" }).click();
  expect(await page.evaluate(() => window.commands[4].args)).toEqual({
    workspaceId: "workspace-one",
    accountId: "account-one",
    conversationId: "actual-conversation",
  });
  await page.evaluate(() =>
    window.commands[4].reject(new Error("stop denied")),
  );
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Anhalten" }).click();
  await page.evaluate(() => {
    window.commands[5].resolve(null);
    window.runs[0].state = "stopped";
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Antwort fortsetzen" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.runs[0].usagePending = false;
    window.runs[0].operationUsagePending = false;
    window.runs[0].heldMicros = 0;
    window.runs[0].inputTokens = 10;
    window.runs[0].outputTokens = 20;
    window.runs[0].estimatedMicros = 30;
    window.runs[0].resultIdeaId = "actual-idea";
    window.messages.push({
      key: "saved-assistant",
      role: "assistant",
      text: "Lesbare echte Antwort.",
      status: "success",
      parts: [{ type: "tool-create_idea", state: "output-available" }],
    });
    window.render();
  });
  await expect(
    page.getByText("Lesbare echte Antwort.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Gespeicherte Idee prüfen · Klärung und Entwurf separat",
    }),
  ).toHaveAttribute("href", "/ideas?idea=actual-idea");
  await page.getByRole("button", { name: "Antwort fortsetzen" }).click();
  expect(await page.evaluate(() => window.commands[6].args)).toMatchObject({
    operationId: "actual-operation",
    expectedRunId: "actual-run",
  });
  await page.evaluate(() => window.commands[6].resolve("actual-continuation"));
  await page
    .getByRole("button", { name: "Neue Unterhaltung", exact: true })
    .last()
    .click(); // title button, separate from action by placement
  await page.getByLabel("Unterhaltung umbenennen").fill("Buffered title");
  await page.getByRole("button", { name: "Titel speichern" }).click();
  await page.evaluate(() =>
    window.commands[7].reject(new Error("CHAT_REVISION_CONFLICT")),
  );
  await expect(page.getByLabel("Unterhaltung umbenennen")).toHaveValue(
    "Buffered title",
  );
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Titel speichern" }),
  ).toBeDisabled();
  await expect(prompt).toBeDisabled();
  await page.evaluate(() => {
    window.projection = { authorized: false, proofExpiresAt: 0 };
    window.render();
  });
  await expect(
    page.getByText("Lesbare echte Antwort.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(/Die Nachrichtenquelle ist nicht mehr/),
  ).toBeVisible();
  await page.evaluate(() => {
    window.projection = { authorized: true, proofExpiresAt: Date.now() + 100 };
    window.render();
  });
  await expect(
    page.getByText("Lesbare echte Antwort.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Lesbare echte Antwort.", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.projection = {
      authorized: true,
      proofExpiresAt: Number.MAX_SAFE_INTEGER,
    };
    window.render();
  });
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await prompt.fill("Old workspace prompt");
  await page.getByRole("button", { name: "Senden", exact: true }).click();
  await page.evaluate(() => {
    window.workspace = "workspace-two";
    window.list = { page: [], isDone: true, continueCursor: "" };
    window.messages = [];
    window.runs = [];
    window.render();
  });
  await page.evaluate(() =>
    window.commands[8].reject(new Error("late old error")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(prompt).toHaveValue("");
  await page.goto("http://127.0.0.1:5174/chat-fixture");
  await expect(
    page.getByRole("link", { name: /Gespeichertes Rechercheprofil/ }),
  ).toHaveAttribute("href", "/research");
  await page.evaluate(() => {
    window.list = {
      page: [
        {
          conversationId: "targeted-personal",
          title: "Targeted personal",
          revision: 1,
          state: "active",
          turns: 0,
          updatedAt: Date.now(),
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.researchProfile = {
      profile: { _id: "saved-profile", revision: 2, paused: false },
      version: {
        config: {
          languages: ["de", "en"],
          cap: { currency: "USD", limitMicros: 20000 },
        },
      },
    };
    window.render();
  });
  const topic = page.getByLabel("Recherchethema"),
    researchButton = page.getByRole("button", {
      name: "Recherche starten",
      exact: true,
    });
  await topic.fill("Explicit personal topic");
  await researchButton.click();
  const initialResearch = await page.evaluate(() => window.commands[0].args);
  expect(initialResearch).toMatchObject({
    conversationId: "targeted-personal",
    profileId: "saved-profile",
    expectedRevision: 2,
    topic: "Explicit personal topic",
    language: "de",
    operations: ["web-search"],
  });
  await expect(researchButton).toBeDisabled();
  await page.evaluate(() => {
    window.commands[0].reject(new Error("RESEARCH_REVISION_CONFLICT"));
    window.researchProfile.profile.revision = 3;
    window.render();
  });
  await expect(topic).toHaveValue("Explicit personal topic");
  await expect(page.getByRole("alert")).toContainText(
    "Das gespeicherte Rechercheprofil wurde inzwischen geändert",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Dein Recherchethema bleibt erhalten",
  );
  await expect(page.getByRole("alert")).not.toContainText("Dein Titel");
  await researchButton.click();
  expect(await page.evaluate(() => window.commands[1].args.operationKey)).toBe(
    initialResearch.operationKey,
  );
  expect(
    await page.evaluate(() => window.commands[1].args.expectedRevision),
  ).toBe(2);
  await page.evaluate(() => {
    window.commands[1].resolve("actual-research-order");
    window.researchOrders = [
      {
        orderId: "actual-research-order",
        state: "running",
        outcome: "pending",
        usagePending: true,
        messageSaved: false,
      },
    ];
    window.render();
  });
  await expect(topic).toHaveValue("");
  await expect(page.getByText(/actual-research-order/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Recherchefortsetzung prüfen" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Recherche anhalten" }).click();
  expect(await page.evaluate(() => window.commands[2])).toMatchObject({
    name: "research/runs:stop",
    args: { workspaceId: "workspace-one", orderId: "actual-research-order" },
  });
  await page.evaluate(() => {
    window.commands[2].resolve(null);
    window.researchOrders[0].state = "cancelled";
    window.researchOrders[0].outcome = "cancelled";
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Recherchefortsetzung prüfen" }),
  ).toHaveCount(0);
  await topic.fill("Role epoch buffer");
  await researchButton.click();
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await page.waitForFunction(() => window.committedRole === "Viewer");
  await expect(topic).toBeDisabled();
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await page.evaluate(() => window.commands[3].resolve("late-role-order"));
  await expect(topic).toHaveValue("Role epoch buffer");
  await page
    .getByLabel("Nachricht an Agent")
    .fill("Protected follow-up buffer");
  await page.evaluate(() => {
    window.messages = [
      {
        key: "source-summary",
        role: "assistant",
        text: "Current evidence-bound summary",
        status: "success",
        parts: [],
      },
    ];
    window.projection = { authorized: true, proofExpiresAt: Date.now() + 150 };
    window.render();
  });
  await expect(page.getByText("Current evidence-bound summary")).toBeVisible();
  await expect(page.getByText("Current evidence-bound summary")).toHaveCount(0);
  await expect(topic).toHaveValue("");
  await expect(page.getByLabel("Nachricht an Agent")).toHaveValue("");
  expect(
    await page.evaluate(() => window.cleanupRequests.length),
  ).toBeGreaterThan(0);
  await expect(researchButton).toBeDisabled();
  await page.goto(
    "http://127.0.0.1:5174/chat-fixture?conversation=inbox-selected-thread",
  );
  await page.evaluate(() => {
    window.list = {
      page: [
        {
          conversationId: "another-thread",
          title: "Another active conversation",
          revision: 1,
          state: "active",
          turns: 0,
        },
        {
          conversationId: "inbox-selected-thread",
          title: "Actual Inbox conversation",
          revision: 1,
          state: "active",
          turns: 0,
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.messages = [
      {
        key: "inbox-summary",
        role: "assistant",
        text: "Exact attached Inbox summary",
        status: "success",
        parts: [],
      },
    ];
    window.render();
  });
  await expect(page.getByText("Exact attached Inbox summary")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.queries
          .filter((q) => q.name === "ai/conversations:projection")
          .at(-1).args.conversationId,
    ),
  ).toBe("inbox-selected-thread");
  await page.getByLabel("Nachricht an Agent").fill("Pending A prompt");
  await page.getByRole("button", { name: "Senden", exact: true }).click();
  const late = await page.evaluate(() => window.commands.length - 1);
  await page.evaluate(() => {
    window.list = { page: [], isDone: true, continueCursor: "" };
    window.messages = [];
  });
  const queryStart = await page.evaluate(() => window.queries.length);
  await page.getByLabel("Aktiver Account").selectOption("account-two");
  await expect(page.getByLabel("Account", { exact: true })).toHaveValue(
    "account-two",
  );
  await expect(page.getByText(/Gedanken sortieren.*@two/)).toBeVisible();
  expect(
    await page.evaluate(() => window.router.state.location.search),
  ).not.toContain("conversation");
  const scopedQueries = await page.evaluate(
    (start) => window.queries.slice(start),
    queryStart,
  );
  expect(
    scopedQueries
      .filter((q) => q.name === "ai/conversations:list")
      .every((q) => q.args.accountId === "account-two"),
  ).toBe(true);
  expect(
    scopedQueries
      .filter((q) => q.name === "ai/conversations:projection")
      .some((q) => q.args.conversationId === "inbox-selected-thread"),
  ).toBe(false);
  expect(
    scopedQueries.filter((q) => q.name === "ai/jev/access:availability").at(-1)
      .args.accountId,
  ).toBe("account-two");
  await page.evaluate(
    (i) => window.commands[i].reject(new Error("Late A response")),
    late,
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Neue Unterhaltung" }).click();
  expect(await page.evaluate(() => window.commands.at(-1).args.accountId)).toBe(
    "account-two",
  );
  await page.getByLabel("Aktiver Account").selectOption("");
  await expect(page.getByLabel("Aktiver Account")).toHaveValue("");
  await expect(
    page.getByText("Wähle einen Account für die Unterhaltung."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Neue Unterhaltung" }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.state.accounts = [];
    window.render();
  });
  await expect(page.getByLabel("Aktiver Account")).toHaveValue("");
  await page.waitForFunction(
    () =>
      document.querySelectorAll("select[aria-label='Aktiver Account'] option")
        .length === 1,
  );
  await expect(page.getByLabel("Aktiver Account").locator("option")).toHaveText(
    "Kein Account verbunden",
  );
  await page.goto("http://127.0.0.1:5174/chat-fixture");
  await page.getByLabel("Aktiver Account").selectOption("account-two");
  await page.evaluate(() => window.router.navigate("/research"));
  await expect(page.getByText(/Research für @two/)).toBeVisible();
  await expect(page.getByText("Inbox für @two")).toBeVisible();
  await page.evaluate(() => window.router.navigate("/plans"));
  await expect(page.getByText(/Planung für @two/)).toBeVisible();
  await page.evaluate(() => {
    window.state.drafts = [
      {
        id: "draft-one",
        workspaceId: window.workspace,
        accountId: "account-one",
        title: "A saved draft",
        pillar: "Product",
        strategy: "generic",
        source: "Manual",
        comments: [],
        status: "draft",
        versions: [
          {
            id: "version-one",
            number: 1,
            text: ["A saved text"],
            mediaIds: [],
            createdAt: new Date().toISOString(),
            reason: "Manual",
          },
        ],
      },
    ];
    window.state.schedules = [
      {
        id: "schedule-one",
        workspaceId: window.workspace,
        draftId: "draft-one",
        accountId: "account-one",
        version: 1,
        text: ["A saved text"],
        mediaIds: [],
        at: new Date(Date.now() + 3600000).toISOString(),
        status: "scheduled",
        generation: 1,
      },
    ];
    window.render();
    window.router.navigate("/drafts/draft-one");
  });
  await expect(page.getByText(/Manueller|Manual.*@one/).first()).toBeVisible();
  await expect(page.getByLabel("Account", { exact: true })).toHaveValue(
    "account-one",
  );
  await page
    .getByRole("button", { name: "Version freigeben", exact: true })
    .first()
    .click();
  expect(await page.evaluate(() => window.actionTargets.at(-1))).toMatchObject({
    name: "approve",
    accountId: "account-one",
  });
  await page.evaluate(() => {
    window.state.drafts[0].approval = {
      version: 1,
      accountId: "account-one",
      at: new Date().toISOString(),
      by: "Owner",
    };
    window.render();
  });
  await page.getByLabel("Account", { exact: true }).selectOption("account-two");
  await expect(
    page.getByText("Diese Arbeitsversion für @two ist noch nicht freigegeben"),
  ).toBeVisible();
  await expect(page.getByText("Version 1 für @two freigegeben")).toHaveCount(0);
  await expect(
    page.getByRole("alert").filter({ hasText: "Wechsel von @one zu @two" }),
  ).toContainText("Snapshot kann weiterhin für @one veröffentlicht werden");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  expect(await page.evaluate(() => window.actionTargets.at(-1))).toMatchObject({
    name: "save",
    args: { accountId: "account-two" },
  });
  mkdirSync(`${artifactDir}/dispatch-task48-evidence/browser`, {
    recursive: true,
  });
  await page.screenshot({
    path: `${artifactDir}/dispatch-task48-evidence/browser/composer-desktop.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${artifactDir}/dispatch-task48-evidence/browser/composer-390.png`,
    fullPage: true,
  });
  // Use a fresh route mount so the unsaved composer navigation blocker remains effective.
  await page.goto("http://127.0.0.1:5174/chat-fixture");
  await page.evaluate(() => {
    window.account = "account-two";
    window.state.drafts = [
      {
        id: "draft-one",
        workspaceId: window.workspace,
        accountId: "account-two",
        title: "B current draft",
        versions: [{ number: 2, text: ["B new version"], mediaIds: [] }],
        comments: [],
      },
    ];
    window.state.schedules = [
      {
        id: "schedule-one",
        workspaceId: window.workspace,
        draftId: "draft-one",
        accountId: "account-one",
        version: 1,
        text: ["A frozen text"],
        mediaIds: [],
        at: new Date(Date.now() + 3600000).toISOString(),
        status: "scheduled",
      },
    ];
    window.render();
    window.router.navigate("/calendar");
  });
  await expect(page.getByRole("dialog")).toContainText("@one");
  await expect(page.getByRole("dialog")).not.toContainText("@two");
  await page
    .getByRole("button", { name: "Termin verschieben", exact: true })
    .click();
  expect(await page.evaluate(() => window.actionTargets.at(-1))).toMatchObject({
    name: "schedule",
    accountId: "account-one",
  });
  await page.screenshot({
    path: `${artifactDir}/dispatch-task48-evidence/browser/schedule-390.png`,
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5174/chat-fixture?demo=1");
  await expect(page.getByText("Mock-Modus", { exact: true })).toHaveCount(1);
  await expect(page.getByText(/Lokal gespeicherte Demo/)).toBeVisible();
  await page.screenshot({
    path: `${artifactDir}/dispatch-task48-evidence/browser/demo-390.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  console.log(
    "Actual styled AppShell/Agent/Research/Inbox/Plans/Composer/Schedule desktop390/Demo: global account switch, initial deep-link, stale URL, late reply, empty selection, actual action/frozen schedule targets, pre-save move warning PASS; existing chat regressions plus targeted personal request/profile guidance/captured revision and stable retry/actual order receipt/stop/unknown resume/role epoch/idle source expiry and buffer cleanup PASS; mocked Convex transport, no provider call.",
  );
} finally {
  await browser?.close();
  await server.close();
}
