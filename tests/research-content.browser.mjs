import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client":
    "export const demoMode=false;export const authClient={useSession:()=>({data:{session:{id:'session-content'},user:{id:'native-auth-user'}}}),signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};",
  "convex/react": `import {useMemo,useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useConvex=()=>({});const subscribe=cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb)};const tick=()=>useSyncExternalStore(subscribe,()=>window.tick);export const useQuery=(ref,args)=>{tick();if(args==='skip')return undefined;const name=getFunctionName(ref);if(name==='users:current')return window.snapshot;if(name==='operations/deletion:mine')return [];if(name==='editorial:resources')return {accounts:[],assets:[]};if(name==='editorial:calendar')return window.calendar??{rows:[],tooDense:false};if(name==='editorial:get')return window.bundles.find(b=>b.draft._id===args.draftId)??null;return undefined};export const usePaginatedQuery=(ref,args)=>{tick();return {results:args==='skip'?[]:getFunctionName(ref)==='editorial:list'?window.bundles:[],status:'Exhausted',loadMore:()=>{}}};export const useMutation=ref=>{const name=getFunctionName(ref);return useMemo(()=>async args=>{window.commands.push({name,args});return 'user'},[name])};export const useAction=useMutation;`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router-dom';import {WorkspaceStoreProvider,useStore} from '/src/lib/store.tsx';import {ComposerPage} from '/src/pages/Drafts.tsx';import {CalendarPage} from '/src/pages/Calendar.tsx';import {createSeed} from '/src/lib/model.ts';const seed=createSeed(),ws=seed.activeWorkspaceId;window.tick=0;window.listeners=new Set();window.commands=[];window.snapshot={authId:'native-auth-user',userId:'native-auth-user',state:'ready',activeWorkspaceId:ws,preferences:seed.preferences,workspaces:[{id:ws,name:'Test',description:'',role:'Owner'}]};const now=Date.now();const bundle=(id,title,until)=>({authId:'native-auth-user',sessionId:'session-content',draft:{_id:id,_creationTime:1,workspaceId:ws,currentVersionId:id+'-version',revision:1,source:'Research technical ref',authorId:'user',updatedAt:1},versions:[{_id:id+'-version',_creationTime:1,workspaceId:ws,draftId:id,number:1,content:{title,text:[title],media:[],accountId:null,pillar:'Research',strategy:'generic'},mediaChecksums:[],authorId:'user',createdAt:1,reason:title,...(until?{sourceProofUntil:until,researchProofUntil:until}:{})}],approvals:[],schedules:[],comments:[],assets:[],historyLimited:false,commentsLimited:false,schedulesLimited:false});window.bundles=[bundle('first','Protected first quote',now+2000),bundle('second','Protected second quote',now+4000),bundle('manual','Manual content',null)];window.update=fn=>{fn();window.tick++;window.listeners.forEach(cb=>cb())};function Probe(){return React.createElement('pre',{'data-testid':'store'},JSON.stringify(useStore().state.drafts))}const element=React.createElement(WorkspaceStoreProvider,null,React.createElement(React.Fragment,null,React.createElement(ComposerPage),React.createElement(Probe)));window.router=createMemoryRouter([{path:'/drafts/:id',element},{path:'/calendar',element:React.createElement(WorkspaceStoreProvider,null,React.createElement(CalendarPage))}],{initialEntries:['/drafts/'+(new URLSearchParams(location.search).get('draft')??'manual')]});ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(React.StrictMode,null,React.createElement(RouterProvider,{router:window.router})));`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/research-content-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "research-content-fixture",
      enforce: "pre",
      resolveId(id) {
        if (
          id === "./auth-client" ||
          id.startsWith(`${root}/src/lib/auth-client`)
        )
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0content-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/content-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__content-entry"></script>',
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
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174/content-fixture");
  const state = page.getByTestId("store");
  await expect(state).toContainText("Protected first quote");
  await expect(state).toContainText("Protected second quote");
  await page
    .getByLabel("Interner Titel", { exact: true })
    .fill("Unrelated human dirty buffer");
  await expect(state).not.toContainText("Protected first quote", {
    timeout: 5000,
  });
  await expect(state).toContainText("Protected second quote");
  await expect(state).not.toContainText("Protected second quote", {
    timeout: 5000,
  });
  await expect(page.getByLabel("Interner Titel", { exact: true })).toHaveValue(
    "Unrelated human dirty buffer",
  );
  await page.goto("http://127.0.0.1:5174/content-fixture?draft=first");
  await expect(page.getByLabel("Interner Titel", { exact: true })).toHaveValue(
    "Protected first quote",
  );
  await page
    .getByLabel("Interner Titel", { exact: true })
    .fill("Protected dirty copied buffer");
  await expect(page.getByLabel("Interner Titel", { exact: true })).toHaveValue(
    "",
    { timeout: 5000 },
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "Quellenfreigabe" }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/task231-content-expiry-browser.png",
    fullPage: true,
  });
  await page.goto("http://127.0.0.1:5174/content-fixture");
  await expect(state).toContainText("Manual content");
  await page.evaluate(() => {
    const b = window.bundles[0],
      at = Date.now();
    window.calendar = {
      tooDense: false,
      rows: [
        {
          schedule: {
            _id: "protected-schedule",
            _creationTime: at,
            workspaceId: b.draft.workspaceId,
            draftId: b.draft._id,
            versionId: b.versions[0]._id,
            versionNumber: 1,
            accountId: "account",
            approvalId: "approval",
            actorId: "owner",
            generation: 1,
            at,
            timezone: "UTC",
            localTime: new Date(at).toISOString(),
            state: "scheduled",
            jobId: null,
          },
          version: {
            ...b.versions[0],
            sourceProofUntil: at + 3000,
            researchProofUntil: at + 3000,
          },
        },
      ],
    };
    window.router.navigate("/calendar?view=agenda");
    window.listeners.forEach((cb) => cb());
  });
  await page.getByRole("button", { name: /Protected first quote/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Protected first quote");
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator("body")).not.toContainText("Protected first quote");
  expect(errors).toEqual([]);
  console.log(
    "PASS: actual WorkspaceStoreProvider clock expires two cached protected items sequentially, masks every derived draft/version title/text, preserves manual dirty buffer, and actual Composer clears protected dirty buffer, and independent Calendar closes its cached protected detail on expiry. Convex transport is mocked; no provider call.",
  );
} finally {
  await browser?.close();
  await server.close();
}
