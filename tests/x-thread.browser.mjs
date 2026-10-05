import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client": `export const demoMode=false;`,
  "convex/react": `export const useAction=()=>async()=>null;export const useMutation=()=>async()=>null;export const useQuery=()=>null;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/store": `import {useSyncExternalStore} from 'react';export const useStore=()=>{const state=useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>window.store.state);return {...window.store,state};};`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router-dom';import {ComposerPage} from '/src/pages/Drafts.tsx';import {createSeed} from '/src/lib/model.ts';
window.pending=[];window.listeners=new Set();
const seed=createSeed(),ws=seed.activeWorkspaceId;
const account={...seed.accounts.find(a=>a.channel==='X' && a.workspaceId===ws),connection:'connected',capability:{maxText:280,maxThread:100,maxMedia:4,mediaTypes:['image'],publish:false},xEvidence:{scopes:['tweet.write','tweet.read','users.read','media.write'],identityVerifiedAt:1,connectionSequence:1,textScopeEligible:true,mediaScopeEligible:true,liveWrite:'unverified'}};
const asset={id:'media',workspaceId:ws,name:'Approved image',alt:'Changed library default',type:'image',size:70,status:'ready',origin:'R2',url:'',mime:'image/png'};
const draft={id:'thread',workspaceId:ws,title:'Exact approved thread',accountId:account.id,pillar:'',strategy:'generic',comments:[],revision:1,versions:[{id:'version-one',number:1,text:['Exact approved first','Exact approved second'],mediaIds:['media'],media:[{assetId:'media',alt:'Exact approved alt'}],createdAt:new Date().toISOString(),reason:'Fixture'}]};
const command=(kind,args)=>new Promise(resolve=>window.pending.push({kind,args,resolve}));
const no=()=>false;
window.store={state:{...seed,role:'Owner',accounts:[account],media:[asset],drafts:[draft],schedules:[]},approveFirstWrite:d=>command('approve',{versionId:d.versions.at(-1).id,accountId:d.accountId}),confirmFirstWrite:(d,id)=>command('confirm',{versionId:d.versions.at(-1).id,accountId:d.accountId,approvalId:id}),saveDraft:d=>command('save',d),approveVersion:async()=>false,revokeApproval:async()=>false,cancelSchedule:async()=>false,replaceSchedule:async()=>false,createDraft:async()=>'',loadMoreVersions:no,hasMoreVersions:false,loadMoreMedia:no,hasMoreMedia:false,members:[],mutate:no,addComment:async()=>false,resolveComment:async()=>false,assignDraft:async()=>false};
window.update=(fn)=>{window.store.state=fn(window.store.state);window.listeners.forEach(cb=>cb());};
const root=ReactDOM.createRoot(document.getElementById('root')),router=createMemoryRouter([{path:'/drafts/:id',element:React.createElement(ComposerPage)}],{initialEntries:['/drafts/thread']});
root.render(React.createElement(React.StrictMode,null,React.createElement(RouterProvider,{router})));
`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/x-thread-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "x-thread-fixture",
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
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174/thread-fixture");
  const start = page.getByRole("button", {
    name: "Ersten X-Beitrag veröffentlichen",
    exact: true,
  });
  await expect(start).toBeEnabled();
  await start.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Version 1");
  await expect(dialog).toContainText("Exact approved first");
  await expect(dialog).toContainText("Exact approved second");
  await expect(dialog).toContainText("Exact approved alt");
  await expect(dialog).not.toContainText("Changed library default");
  await expect(dialog).toContainText("Alle Medien gehören zum ersten Beitrag");
  const approve = page.getByRole("button", {
    name: "Diesen Inhalt für Erstveröffentlichung freigeben",
    exact: true,
  });
  await approve.click();
  await expect(
    page.getByRole("button", { name: "Freigabe wird gespeichert …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending.length)).toBe(1);
  expect(await page.evaluate(() => window.pending[0].args.versionId)).toBe(
    "version-one",
  );
  await page.evaluate(() => window.pending[0].resolve("proof-approval"));
  const confirm = page.getByRole("button", {
    name: "Jetzt sichtbar veröffentlichen und Zugang belegen",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Sichtbare Veröffentlichung bestätigen" })
    .check();
  await confirm.click();
  await expect(
    page.getByRole("button", { name: "Start wird bestätigt …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending.length)).toBe(2);
  expect(await page.evaluate(() => window.pending[1].args)).toMatchObject({
    versionId: "version-one",
    approvalId: "proof-approval",
  });
  await page.evaluate(() => window.pending[1].resolve(false));
  await expect(dialog.getByRole("alert")).toContainText(
    "Eingabe bleibt erhalten",
  );
  await expect(dialog).toContainText("Exact approved first");
  await page.getByRole("button", { name: "Schließen" }).click();
  const text = page.locator("textarea").first();
  await text.fill("界".repeat(141));
  await expect(page.getByText("282 / 280", { exact: true })).toBeVisible();
  await expect(start).toBeDisabled();
  expect(await page.evaluate(() => window.pending.length)).toBe(2);
  // A remote revision while local edits exist keeps the local buffer and blocks first-write approval.
  await page.evaluate(() =>
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
            text: ["Remote new text", "Remote reply"],
          },
        ],
      })),
    })),
  );
  await expect(text).toHaveValue("界".repeat(141));
  await expect(start).toBeDisabled();
  await expect(page.getByRole("alert").first()).toContainText("neuere Version");
  // Actual results render confirmed IDs only; unknown missing positions cannot be simulated by a real continuation button.
  await page.evaluate(() =>
    window.update((s) => ({
      ...s,
      schedules: [
        {
          id: "job",
          workspaceId: s.activeWorkspaceId,
          draftId: "thread",
          accountId: s.accounts[0].id,
          version: 1,
          text: ["Exact approved first", "Exact approved second"],
          mediaIds: ["media"],
          media: [{ assetId: "media", alt: "Exact approved alt" }],
          at: new Date().toISOString(),
          status: "uncertain",
          publishedCount: 1,
          error: "Unklarer Ausgang; externer Abgleich erforderlich.",
          externalPosts: [
            {
              position: 0,
              externalId: "123",
              url: "https://x.com/i/web/status/123",
              attemptId: "operation",
              confirmedAt: 1,
            },
          ],
        },
      ],
    })),
  );
  await expect(
    page.getByRole("link", { name: "Bestätigter X-Beitrag 123" }),
  ).toHaveAttribute("href", "https://x.com/i/web/status/123");
  await expect(
    page.getByText(
      "Externer Abgleich und explizite Fortsetzung sind noch nicht verfügbar. Bestätigte Beiträge werden nicht wiederholt.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: real Composer exact snapshot, separate awaited consent, failure buffer, weighted CJK count, remote conflict, confirmed links and unknown result.",
  );
} finally {
  await browser?.close();
  await server.close();
}
