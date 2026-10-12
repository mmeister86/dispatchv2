import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
import React from 'react';
const subscribe=callback=>{window.subscribers.add(callback);return()=>window.subscribers.delete(callback)};
const useTick=()=>React.useSyncExternalStore(subscribe,()=>window.tick);
const mutations=new Map();
export const useMutation=ref=>{const name=getFunctionName(ref);if(!mutations.has(name))mutations.set(name,async args=>{
window.commands.push({name,args});if(name==='users:bootstrap'){if(!window.deferBootstrap)return 'user';return new Promise((resolve,reject)=>window.bootstrapPending.push({resolve,reject}));}
return new Promise((resolve,reject)=>window.pending.push({name,args,resolve,reject}));});return mutations.get(name)};
export const useQuery=(ref,args)=>{useTick();const name=getFunctionName(ref);if(args==='skip')return undefined;if(name==='operations/deletion:mine')return window.deletionJobs??[];if(name==='users:current'){window.currentReads.push(args);return window.snapshot;}
window.protected.push({name,args});return name==='editorial:resources'?window.resources[args.workspaceId]:undefined};
export const usePaginatedQuery=(ref,args)=>{useTick();const name=getFunctionName(ref);if(args!=='skip')window.protected.push({name,args});return {results:[],status:'Exhausted',loadMore:()=>{}}};`,
  "@/lib/auth-client": `import React from 'react';export const demoMode=false;export const authClient={useSession:()=>{React.useSyncExternalStore(cb=>{window.subscribers.add(cb);return()=>window.subscribers.delete(cb)},()=>window.tick);return {data:window.session,isPending:false}}};`,
  sonner: `export const toast={error:message=>window.notifications.push(message)};`,
};
const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';
import {WorkspaceStoreProvider,useStore} from '/src/lib/store.tsx';import '/src/index.css';
window.tick=0;window.subscribers=new Set();window.commands=[];window.pending=[];window.protected=[];window.notifications=[];window.currentReads=[];window.deferBootstrap=false;window.bootstrapPending=[];
const profile=name=>({name,timezone:'Europe/Berlin',language:'Deutsch',audience:'',tone:'',topics:'',onboardingDone:true,onboardingStep:3});
window.session={user:{id:'auth-alpha'}};window.ready=(id,role='Owner',authId=window.session.user.id)=>({state:'ready',authId,userId:authId+'-app-user',activeWorkspaceId:id,workspaces:[{id,name:id,description:'',role}],preferences:profile(id),repairWorkspaceId:null});
window.resources={alpha:{accounts:[{_id:'alpha-account',workspaceId:'alpha',name:'Alpha secret account',handle:'@alpha',provider:'X',connection:'connected',capability:{}}],assets:[],events:[],members:[],notifications:[],resourcesLimited:false},beta:{accounts:[{_id:'beta-account',workspaceId:'beta',name:'Beta account',handle:'@beta',provider:'X',connection:'connected',capability:{}}],assets:[],events:[],members:[],notifications:[],resourcesLimited:false}};
window.snapshot=window.ready('alpha');window.updateSnapshot=value=>{window.snapshot=value;window.tick++;window.subscribers.forEach(fn=>fn());};
function Probe(){const s=useStore();return React.createElement('div',null,React.createElement('output',{'data-testid':'state'},JSON.stringify({workspace:s.state.activeWorkspaceId,name:s.state.preferences.name,account:s.state.activeAccountId,accounts:s.state.accounts.map(a=>a.name),drafts:s.state.drafts.length,media:s.state.media.length})),React.createElement('button',{onClick:()=>s.selectAccount('alpha-account')},'Alpha auswählen'));}
if(location.hash==='#deletion')window.deletionJobs=[{id:'delete-job',scope:'account',state:'blocked',phase:'components',processed:42,reason:'component-proof',canResume:true}];
window.fixtureRoot=createRoot(document.getElementById('root'));window.fixtureRoot.render(React.createElement(MemoryRouter,{initialEntries:['/overview']},React.createElement(WorkspaceStoreProvider,null,React.createElement(Probe))));`;
const server = await createServer({
  root,
  cacheDir: "/tmp/dispatch-49.1-recovery-vite",
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5182, strictPort: true },
  plugins: [
    {
      name: "workspace-recovery-fixture",
      enforce: "pre",
      resolveId(id) {
        if (
          id === "./auth-client" ||
          id === "@/lib/auth-client" ||
          id.startsWith(`${root}/src/lib/auth-client`)
        )
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0workspace-recovery-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url !== "/workspace-recovery-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__workspace-recovery-entry"></script>',
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
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5182/workspace-recovery-fixture");
  const state = page.getByTestId("state");
  await expect(state).toContainText("Alpha secret account");
  await page.getByRole("button", { name: "Alpha auswählen" }).click();
  await expect(state).toContainText("alpha-account");
  await page.evaluate(() =>
    window.updateSnapshot(window.ready("alpha", "Viewer")),
  );
  await expect(state).toContainText("Alpha secret account");
  expect(JSON.parse(await state.textContent()).account).toBe("");
  await page.getByRole("button", { name: "Alpha auswählen" }).click();
  await expect(state).toContainText("alpha-account");
  await page.evaluate(() => {
    window.protected = [];
    window.updateSnapshot({
      state: "recovery",
      authId: window.session.user.id,
      userId: "real-user",
      activeWorkspaceId: null,
      workspaces: [
        { id: "beta", name: "Beta verfügbar", description: "", role: "Viewer" },
      ],
      preferences: null,
      repairWorkspaceId: "beta",
    });
  });
  await expect(state).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(
    "Workspace-Zugriff wiederherstellen",
  );
  await expect(
    page.getByRole("button", { name: "Beta verfügbar" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.protected)).toEqual([]);
  await page.getByRole("button", { name: "Beta verfügbar" }).click();
  await expect(
    page.getByRole("button", { name: "Beta verfügbar" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending[0].args)).toEqual({
    workspaceId: "beta",
  });
  await page.evaluate(() =>
    window.pending[0].reject(new Error("WORKSPACE_ACCESS_DENIED")),
  );
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Beta verfügbar" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Beta verfügbar" }).click();
  await page.evaluate(() => {
    window.pending[1].resolve(null);
    window.updateSnapshot(window.ready("beta", "Viewer"));
  });
  await expect(state).toContainText("Beta account");
  await expect(state).not.toContainText("Alpha");
  await expect(state).not.toContainText("alpha-account");
  expect(JSON.parse(await state.textContent()).account).toBe("");
  // Actual auth identity changes while an old ready/recovery subscription result is delayed.
  await page.evaluate(() => {
    window.protected = [];
    window.session = { user: { id: "auth-beta" } };
    window.updateSnapshot(window.snapshot);
  });
  await expect(state).toHaveCount(0);
  expect(await page.evaluate(() => window.protected)).toEqual([]);
  await page.evaluate(() =>
    window.updateSnapshot({
      state: "recovery",
      authId: "auth-alpha",
      userId: "auth-alpha-app-user",
      activeWorkspaceId: null,
      workspaces: [
        {
          id: "alpha",
          name: "OLD PRIVATE ACTOR WORKSPACE",
          description: "",
          role: "Owner",
        },
      ],
      preferences: null,
      repairWorkspaceId: "alpha",
    }),
  );
  await expect(page.getByText("OLD PRIVATE ACTOR WORKSPACE")).toHaveCount(0);
  expect(await page.evaluate(() => window.protected)).toEqual([]);
  await page.evaluate(() =>
    window.updateSnapshot(window.ready("beta", "Viewer")),
  );
  await expect(state).toContainText("Beta account");
  expect(JSON.parse(await state.textContent()).account).toBe("");

  // The previous actor's bootstrap completes after a second session switch.
  await page.evaluate(() => {
    window.deferBootstrap = true;
    window.session = { user: { id: "auth-gamma" } };
    window.updateSnapshot(window.snapshot);
  });
  await expect
    .poll(() => page.evaluate(() => window.bootstrapPending.length))
    .toBe(1);
  await page.evaluate(() => {
    window.session = { user: { id: "auth-delta" } };
    window.updateSnapshot(window.snapshot);
  });
  await expect
    .poll(() => page.evaluate(() => window.bootstrapPending.length))
    .toBe(2);
  await page.evaluate(() => {
    window.currentReads = [];
    window.bootstrapPending[0].resolve("old-user");
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => window.currentReads)).toEqual([]);
  await expect(state).toHaveCount(0);
  await page.evaluate(() => {
    window.bootstrapPending[1].resolve("current-user");
    window.updateSnapshot(window.ready("beta", "Viewer"));
  });
  await expect(state).toContainText("Beta account");

  await page.evaluate(() => {
    window.protected = [];
    window.updateSnapshot({
      state: "no-workspaces",
      authId: window.session.user.id,
      userId: "real-user",
      activeWorkspaceId: null,
      workspaces: [],
      preferences: null,
      repairWorkspaceId: null,
    });
  });
  await expect(state).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Neuen Workspace erstellen" }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.protected)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  mkdirSync("/tmp/dispatch-49.1-browser-pixels", { recursive: true });
  await page.screenshot({
    path: "/tmp/dispatch-49.1-browser-pixels/recovery-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  // Two real intercepted creates across A→B→A; C1 may not release C2's pending lock.
  const createButton = page.getByRole("button", {
    name: "Neuen Workspace erstellen",
  });
  await page.evaluate(() => {
    window.deferBootstrap = false;
    window.pending = [];
  });
  await createButton.focus();
  await page.keyboard.press("Enter");
  await expect(createButton).toBeDisabled();
  await page.evaluate(() => {
    window.session = { user: { id: "different-actor" } };
    window.updateSnapshot({
      state: "no-workspaces",
      authId: "different-actor",
      userId: "different-app-user",
      activeWorkspaceId: null,
      workspaces: [],
      preferences: null,
      repairWorkspaceId: null,
    });
  });
  await expect(createButton).toBeEnabled();
  await page.evaluate(() => {
    window.session = { user: { id: "auth-delta" } };
    window.updateSnapshot({
      state: "no-workspaces",
      authId: "auth-delta",
      userId: "real-user",
      activeWorkspaceId: null,
      workspaces: [],
      preferences: null,
      repairWorkspaceId: null,
    });
  });
  await expect(createButton).toBeEnabled();
  await createButton.focus();
  await page.keyboard.press("Enter");
  await expect(createButton).toBeDisabled();
  expect(await page.evaluate(() => window.pending.length)).toBe(2);
  await page.screenshot({
    path: "/tmp/dispatch-49.1-browser-pixels/create-current-pending.png",
    fullPage: true,
  });
  await page.evaluate(() => window.pending[0].resolve("old-created-workspace"));
  await page.waitForTimeout(100);
  await expect(createButton).toBeDisabled();
  await page.screenshot({
    path: "/tmp/dispatch-49.1-browser-pixels/create-old-completed.png",
    fullPage: true,
  });
  await page.evaluate(() => window.updateSnapshot({ ...window.snapshot }));
  await page.waitForTimeout(50);
  await page.evaluate(() =>
    window.pending[1].resolve("current-created-workspace"),
  );
  await expect(createButton).toBeEnabled();

  // The same user receives a new native session; old errors cannot release or overwrite C4.
  await page.evaluate(() => {
    window.session = {
      user: { id: "auth-delta" },
      session: { id: "session-one" },
    };
    window.updateSnapshot({ ...window.snapshot });
  });
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await expect(createButton).toBeDisabled();
  await page.evaluate(() => {
    window.session = {
      user: { id: "auth-delta" },
      session: { id: "session-two" },
    };
    window.updateSnapshot({ ...window.snapshot });
  });
  await expect(createButton).toBeEnabled();
  await createButton.click();
  await expect(createButton).toBeDisabled();
  expect(await page.evaluate(() => window.pending.length)).toBe(4);
  await page.evaluate(() =>
    window.pending[2].reject(new Error("obsolete session failure")),
  );
  await page.waitForTimeout(100);
  await expect(createButton).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  // A legitimate same-session reactive snapshot change preserves ownership of current completion.
  await page.evaluate(() => window.updateSnapshot({ ...window.snapshot }));
  await page.waitForTimeout(50);
  await page.evaluate(() =>
    window.pending[3].reject(new Error("controlled current create failure")),
  );
  await expect(createButton).toBeEnabled();
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        window.commands.filter((c) => c.name === "workspaces:create").length,
    ),
  ).toBe(4);
  await page.screenshot({
    path: "/tmp/dispatch-49.1-browser-pixels/current-recovery-error.png",
    fullPage: true,
  });

  await page.evaluate(() => {
    window.protected = [];
    window.fixtureRoot.unmount();
    window.updateSnapshot(window.ready("alpha"));
  });
  await expect(state).toHaveCount(0);
  expect(await page.evaluate(() => window.protected)).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() =>
      window.commands.filter(
        (c) =>
          ![
            "users:bootstrap",
            "workspaces:select",
            "workspaces:create",
          ].includes(c.name),
      ),
    ),
  ).toEqual([]);
  await page.goto("http://127.0.0.1:5182/workspace-recovery-fixture#deletion");
  await page.reload();
  await expect(page.getByText("Löschung läuft", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "42 Einträge verarbeitet",
  );
  await expect(
    page.getByRole("button", { name: "Löschung fortsetzen" }),
  ).toBeVisible();
  await expect(page.getByTestId("state")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.commands.filter((c) => c.name === "users:bootstrap"),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => window.protected)).toEqual([]);
  expect(errors).toEqual([]);
  console.log(
    "PASS actual styled WorkspaceStoreProvider: recovery/no-target unmount, no protected queries, explicit select error/retry, Viewer ready, actor switch/delayed ready and recovery/bootstrap completion/unmount, ABA and same-user session operation success/error ownership, account buffer reset, 390px, zero non-allowed mutation IO",
  );
} finally {
  await browser?.close();
  await server.close();
}
