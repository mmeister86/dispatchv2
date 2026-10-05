import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "@/lib/auth-client": `export const demoMode=false;`,
  "convex/react": `import {useSyncExternalStore} from 'react';import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';const noop=async()=>null;const lookup=args=>new Promise(resolve=>window.pending.push({kind:'reconcile',args,resolve})),resume=args=>new Promise(resolve=>window.pending.push({kind:'continue',args,resolve}));export const useAction=ref=>getFunctionName(ref)==='publishing/reconcile:lookup'?lookup:noop;export const useMutation=ref=>getFunctionName(ref)==='publishing/reconcile:continueThread'?resume:getFunctionName(ref)==='publishing/reconcile:finalizeAbort'?args=>new Promise(resolve=>window.pending.push({kind:'abort',args,resolve})):noop;export const useQuery=ref=>useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>getFunctionName(ref)==='publishing/reconcile:inspect'?window.recovery??null:getFunctionName(ref)==='editorial:calendar'?window.calendar??undefined:null);export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/store": `import {useSyncExternalStore} from 'react';export const useStore=()=>{const state=useSyncExternalStore(cb=>{window.listeners.add(cb);return()=>window.listeners.delete(cb);},()=>window.store.state);return {...window.store,state};};`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router-dom';import {ComposerPage} from '/src/pages/Drafts.tsx';import {CalendarPage} from '/src/pages/Calendar.tsx';import {createSeed} from '/src/lib/model.ts';
window.pending=[];window.listeners=new Set();window.recovery={aborted:false,positions:[{position:0,stage:"confirmed",errorCode:null,notBefore:null},{position:1,stage:"unknown",errorCode:null,notBefore:null}]};
const seed=createSeed(),ws=seed.activeWorkspaceId;
const account={...seed.accounts.find(a=>a.channel==='X' && a.workspaceId===ws),connection:'connected',capability:{maxText:280,maxThread:100,maxMedia:4,mediaTypes:['image'],publish:false},xEvidence:{scopes:['tweet.write','tweet.read','users.read','media.write'],identityVerifiedAt:1,connectionSequence:1,textScopeEligible:true,mediaScopeEligible:true,liveWrite:'unverified'}};
const asset={id:'media',workspaceId:ws,name:'Approved image',alt:'Changed library default',type:'image',size:70,status:'ready',origin:'R2',url:'',mime:'image/png'};
const draft={id:'thread',workspaceId:ws,title:'Exact approved thread',accountId:account.id,pillar:'',strategy:'generic',comments:[],revision:1,versions:[{id:'version-one',number:1,text:['Exact approved first','Exact approved second'],mediaIds:['media'],media:[{assetId:'media',alt:'Exact approved alt'}],createdAt:new Date().toISOString(),reason:'Fixture'}]};
const command=(kind,args)=>new Promise(resolve=>window.pending.push({kind,args,resolve}));
const no=()=>false;
window.store={state:{...seed,role:'Owner',accounts:[account],media:[asset],drafts:[draft],schedules:[]},approveFirstWrite:d=>command('approve',{versionId:d.versions.at(-1).id,accountId:d.accountId}),confirmFirstWrite:(d,id)=>command('confirm',{versionId:d.versions.at(-1).id,accountId:d.accountId,approvalId:id}),saveDraft:d=>command('save',d),approveVersion:async()=>false,revokeApproval:async()=>false,cancelSchedule:s=>command('cancel',{scheduleId:s.id,expectedGeneration:s.generation}),replaceSchedule:async()=>false,createDraft:async()=>'',loadMoreVersions:no,hasMoreVersions:false,loadMoreMedia:no,hasMoreMedia:false,members:[],mutate:no,addComment:async()=>false,resolveComment:async()=>false,assignDraft:async()=>false};
window.update=(fn)=>{window.store.state=fn(window.store.state);window.listeners.forEach(cb=>cb());};
const root=ReactDOM.createRoot(document.getElementById('root')),router=createMemoryRouter([{path:'/drafts/:id',element:React.createElement(ComposerPage)},{path:'/calendar',element:React.createElement(CalendarPage)}],{initialEntries:['/drafts/thread']});
window.router=router;root.render(React.createElement(React.StrictMode,null,React.createElement(RouterProvider,{router})));
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
          generation: 1,
          workspaceId: s.activeWorkspaceId,
          draftId: "thread",
          accountId: s.accounts[0].id,
          version: 1,
          text: [
            "Exact approved first",
            "Exact approved second",
            "Exact approved third",
          ],
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
  const candidate = page.getByLabel("Kandidaten-ID oder X-Link für Beitrag 2");
  const resume = page.getByRole("button", {
    name: "Unveränderten Thread ausdrücklich fortsetzen",
  });
  await expect(resume).toBeDisabled();
  await candidate.fill("https://x.com/fixture/status/124");
  await page
    .getByRole("button", { name: "Beitrag 2 nur lesend abgleichen" })
    .click();
  await expect(candidate).toBeDisabled();
  expect(await page.evaluate(() => window.pending.at(-1).args)).toMatchObject({
    scheduleId: "job",
    position: 1,
    candidateId: "https://x.com/fixture/status/124",
    expectedGeneration: 1,
  });
  await expect(
    page.getByRole("button", { name: "Befehl wird ausgeführt …" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.pending.at(-1).resolve("unknown");
    window.recovery = {
      ...window.recovery,
      positions: window.recovery.positions.map((p) =>
        p.position === 1 ? { ...p, notBefore: Date.now() + 250 } : p,
      ),
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(
    page.getByRole("button", { name: "Beitrag 2 nur lesend abgleichen" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Beitrag 2 nur lesend abgleichen" }),
  ).toBeEnabled();
  await expect(candidate).toHaveValue("https://x.com/fixture/status/124");
  await expect(page.getByText(/Ausgang weiterhin ungeklärt/)).toBeVisible();
  await page
    .getByRole("button", { name: "Beitrag 2 nur lesend abgleichen" })
    .click();
  await page.evaluate(() => {
    window.pending.at(-1).resolve("confirmed");
    window.recovery = {
      aborted: false,
      positions: [
        { position: 0, stage: "confirmed", errorCode: null, notBefore: null },
        { position: 1, stage: "confirmed", errorCode: null, notBefore: null },
        { position: 2, stage: "unsent", errorCode: null, notBefore: null },
      ],
    };
    window.update((s) => ({
      ...s,
      schedules: s.schedules.map((s) => ({
        ...s,
        status: "partial",
        publishedCount: 2,
        externalPosts: [
          ...s.externalPosts,
          {
            position: 1,
            externalId: "124",
            url: "https://x.com/i/web/status/124",
            attemptId: "reconciled",
            confirmedAt: 1,
          },
        ],
      })),
    }));
    window.listeners.forEach((cb) => cb());
  });
  await expect(page.getByText(/Dieser Beitrag wurde bestätigt/)).toBeVisible();
  await expect(resume).toBeDisabled();
  expect(
    await page.evaluate(
      () => window.pending.filter((p) => p.kind === "continue").length,
    ),
  ).toBe(0);
  await page
    .getByRole("checkbox", { name: "Sichtbare Fortsetzung bestätigen" })
    .check();
  await resume.click();
  await expect(
    page.getByRole("button", { name: "Befehl wird ausgeführt …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending.at(-1).args)).toMatchObject({
    scheduleId: "job",
    expectedGeneration: 1,
  });
  await page.evaluate(() => window.pending.at(-1).resolve(null));
  await expect(
    page.getByText(/Die unveränderte Snapshot-Version wurde neu freigegeben/),
  ).toBeVisible();
  await expect(text).toHaveValue("界".repeat(141));
  await page.evaluate(() => {
    window.recovery = { ...window.recovery, aborted: true };
    window.listeners.forEach((cb) => cb());
  });
  await expect(page.getByText(/Der Abbruch bleibt gespeichert/)).toBeVisible();
  await expect(resume).toHaveCount(0);
  await page
    .getByRole("button", { name: "Abbruch abschließen", exact: true })
    .click();
  expect(await page.evaluate(() => window.pending.at(-1))).toMatchObject({
    kind: "abort",
    args: { scheduleId: "job", expectedGeneration: 1 },
  });
  await page.evaluate(() => window.pending.at(-1).resolve(null));
  await expect(
    page.getByText(/Der gespeicherte Abbruch wurde anhand/),
  ).toBeVisible();
  await page.evaluate(() => {
    const s = window.store.state.schedules[0],
      at = Date.now();
    window.recovery = {
      aborted: false,
      positions: [
        { position: 0, stage: "confirmed", errorCode: null, notBefore: null },
        { position: 1, stage: "unknown", errorCode: null, notBefore: null },
        { position: 2, stage: "unsent", errorCode: null, notBefore: null },
      ],
    };
    window.calendar = {
      tooDense: false,
      rows: [
        {
          schedule: {
            _id: s.id,
            _creationTime: at,
            workspaceId: s.workspaceId,
            draftId: s.draftId,
            versionId: "version-one",
            versionNumber: 1,
            accountId: s.accountId,
            approvalId: "approval",
            actorId: "owner",
            generation: 1,
            at,
            timezone: "UTC",
            localTime: new Date(at).toISOString(),
            state: "reconciliation_required",
            publishedCount: 1,
            errorCode: "X_POST_OUTCOME_UNKNOWN",
            jobId: null,
            externalPosts: s.externalPosts.slice(0, 1),
          },
          version: {
            _id: "version-one",
            _creationTime: at,
            workspaceId: s.workspaceId,
            draftId: s.draftId,
            number: 1,
            content: {
              title: "Exact calendar snapshot",
              accountId: s.accountId,
              text: s.text,
              media: s.media,
              pillar: "",
              strategy: "generic",
            },
            authorId: "owner",
            createdAt: at,
            reason: "Fixture",
          },
        },
      ],
    };
    window.router.navigate("/calendar?view=agenda");
    window.listeners.forEach((cb) => cb());
  });
  await page
    .getByRole("button", { name: "Änderungen verwerfen", exact: true })
    .click();
  await page.getByRole("button", { name: /Exact approved thread/ }).click();
  const calendarDialog = page.getByRole("dialog");
  await expect(calendarDialog).toContainText("Exact approved third");
  await expect(calendarDialog).toContainText("Exact approved alt");
  const unknownCandidate = calendarDialog.getByLabel(
    "Kandidaten-ID oder X-Link für Beitrag 2",
  );
  await unknownCandidate.fill("124");
  await calendarDialog
    .getByRole("button", { name: "Auftrag abbrechen", exact: true })
    .click();
  await expect(unknownCandidate).toBeDisabled();
  await expect(
    calendarDialog.getByRole("button", {
      name: "Auftrag abbrechen",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending.at(-1))).toMatchObject({
    kind: "cancel",
    args: { scheduleId: "job", expectedGeneration: 1 },
  });
  await page.evaluate(() => window.pending.at(-1).resolve(false));
  await expect(
    calendarDialog.getByText(/Abbruch konnte nicht gespeichert werden/),
  ).toBeVisible();
  await expect(unknownCandidate).toHaveValue("124");
  await calendarDialog
    .getByRole("button", { name: "Auftrag abbrechen", exact: true })
    .click();
  await page.evaluate(() => {
    window.pending.at(-1).resolve(true);
    window.recovery = { ...window.recovery, aborted: true };
    window.listeners.forEach((cb) => cb());
  });
  await expect(
    calendarDialog.getByText(/Der Abbruch bleibt gespeichert/),
  ).toBeVisible();
  await expect(unknownCandidate).toHaveValue("124");
  await expect(
    calendarDialog.getByRole("button", {
      name: "Abbruch abschließen",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    calendarDialog.getByRole("button", {
      name: "Unveränderten Thread ausdrücklich fortsetzen",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    calendarDialog.getByRole("link", { name: "X-Beitrag 123", exact: true }),
  ).toHaveAttribute("href", "https://x.com/i/web/status/123");
  await expect(
    calendarDialog.getByLabel("Kandidaten-ID oder X-Link für Beitrag 2"),
  ).toBeVisible();

  await expect(
    calendarDialog.getByRole("button", { name: "Termin verschieben" }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.recovery = {
      aborted: false,
      positions: [
        { position: 0, stage: "confirmed", errorCode: null, notBefore: null },
        { position: 1, stage: "unsent", errorCode: null, notBefore: null },
        { position: 2, stage: "unsent", errorCode: null, notBefore: null },
      ],
    };
    window.calendar = {
      ...window.calendar,
      rows: window.calendar.rows.map((row) => ({
        ...row,
        schedule: { ...row.schedule, state: "partially_published" },
      })),
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(calendarDialog).toContainText(
    "Freigegebener Alt-Text: Exact approved alt",
  );
  await expect(calendarDialog).not.toContainText("Changed library default");
  await expect(
    calendarDialog.getByRole("button", {
      name: "Termin stornieren",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    calendarDialog.getByRole("button", {
      name: "Auftrag abbrechen",
      exact: true,
    }),
  ).toHaveCount(1);
  const calendarContinue = calendarDialog.getByRole("button", {
    name: "Unveränderten Thread ausdrücklich fortsetzen",
    exact: true,
  });
  await expect(calendarContinue).toBeDisabled();
  await calendarDialog
    .getByRole("checkbox", { name: "Sichtbare Fortsetzung bestätigen" })
    .check();
  await expect(calendarContinue).toBeEnabled();
  await page.evaluate(() => {
    window.recovery = {
      aborted: false,
      positions: [
        { position: 0, stage: "confirmed", errorCode: null, notBefore: null },
        { position: 1, stage: "confirmed", errorCode: null, notBefore: null },
        { position: 2, stage: "unknown", errorCode: null, notBefore: null },
      ],
    };
    window.listeners.forEach((cb) => cb());
  });
  await calendarDialog
    .getByLabel("Kandidaten-ID oder X-Link für Beitrag 3")
    .fill("999");
  await page.evaluate(() => {
    const posts = [123, 124, 125].map((id, position) => ({
      position,
      externalId: String(id),
      url: `https://x.com/i/web/status/${id}`,
      attemptId: `late-${position}`,
      confirmedAt: 1,
    }));
    window.recovery = {
      aborted: false,
      positions: posts.map((p) => ({
        position: p.position,
        stage: "confirmed",
        errorCode: null,
        notBefore: null,
      })),
    };
    window.calendar = {
      ...window.calendar,
      rows: window.calendar.rows.map((row) => ({
        ...row,
        schedule: {
          ...row.schedule,
          state: "reconciliation_required",
          publishedCount: 3,
          externalPosts: posts,
        },
      })),
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(
    calendarDialog.getByLabel("Kandidaten-ID oder X-Link für Beitrag 2"),
  ).toHaveCount(0);
  await expect(calendarContinue).toBeDisabled();
  await calendarDialog
    .getByRole("button", {
      name: "Gespeichertes Ergebnis bestätigen",
      exact: true,
    })
    .click();
  await expect(
    calendarDialog.getByRole("button", {
      name: "Gespeichertes Ergebnis bestätigen",
      exact: true,
    }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.pending.at(-1))).toMatchObject({
    kind: "reconcile",
    args: {
      scheduleId: "job",
      expectedGeneration: 1,
      position: 2,
      candidateId: "125",
    },
  });
  await page.evaluate(() => {
    window.pending.at(-1).resolve("confirmed");
    window.calendar = {
      ...window.calendar,
      rows: window.calendar.rows.map((row) => ({
        ...row,
        schedule: { ...row.schedule, state: "published" },
      })),
    };
    window.listeners.forEach((cb) => cb());
  });
  await expect(
    calendarDialog.getByRole("button", {
      name: "Gespeichertes Ergebnis bestätigen",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    calendarDialog.getByRole("link", { name: "X-Beitrag 125", exact: true }),
  ).toHaveAttribute("href", "https://x.com/i/web/status/125");
  expect(errors).toEqual([]);
  console.log(
    "PASS: real Composer exact snapshot, separate awaited consent, failure buffer, weighted CJK count, remote conflict, confirmed links, awaited read-only reconciliation, preserved buffers, separate continuation consent and abort barrier.",
  );
} finally {
  await browser?.close();
  await server.close();
}
