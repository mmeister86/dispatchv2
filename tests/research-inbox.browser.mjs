import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='research/profiles:get')return window.profile;if(name==='research/profiles:configuration')return window.configuration;if(name==='research/runs:history')return window.orderHistory;if(name==='research/native:availability')return window.sourceAvailability??[];if(name==='research/native:results')return window.sourceResults??[];if(name==='research/evidence:inbox')return window.inbox??{page:[],isDone:true,continueCursor:''};if(name==='research/evidence:list')return window.evidenceRows??[];if(name==='research/pipeline:results')return window.pipelineResults??null;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';`,
  "@/lib/store": `import {useState,useEffect} from 'react';export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>{const role=window.role;useEffect(()=>{window.committedRole=role;},[role]);return ({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role,accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[],ideas:[]},createDraft:()=>{throw new Error('No fake real draft');},mutate:()=>{}});};`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {ResearchPage} from '/src/pages/Research.tsx';window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.queries=[];window.commands=[];window.profile=undefined;window.configuration={currency:null,downstreamAvailable:false};window.orderHistory={page:[],isDone:true,continueCursor:''};const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement(ResearchPage))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/research-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "research-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0research-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/research-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__research-entry"></script>',
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
  await page.goto("http://127.0.0.1:5174/research-fixture");
  await page.evaluate(() => {
    window.profile = {
      profile: {
        _id: "profile-one",
        revision: 2,
        paused: false,
        deleted: false,
        scheduleActive: false,
        activeOrderId: null,
        nextAt: null,
      },
      version: {
        config: {
          topics: "Product",
          project: "",
          audience: "Builders",
          languages: ["de"],
          regions: [],
          preferredSources: [],
          exclusions: "",
          freshnessDays: 30,
          topicCount: 5,
          frequency: "manual",
          timeZone: "Europe/Berlin",
          clock: "09:00",
          weekday: 1,
          cap: { currency: "USD", limitMicros: 10000 },
          autoHandoff: false,
        },
      },
    };
    window.inbox = {
      page: [
        {
          evidenceId: "evidence-one",
          orderId: "order-one",
          runState: "completed",
          runOutcome: "partial",
          automaticHandoff: null,
          inboxRevision: 0,
          inboxDisposition: "active",
          state: "review",
          reason: null,
          proofUntil: Date.now() + 60000,
          automaticEligible: false,
          assessment: null,
          validityUntil: null,
          payload: {
            annotation: {
              claim: "Actual inbox claim",
              interpretation: "Interpretation",
              gaps: ["Open gap"],
              uncertainty: "Unverified",
              relevance: "Relevant",
              novelty: "Unknown",
            },
            perspective: { audience: "Builders", topics: "Product" },
          },
          source: {
            url: "https://example.test/current",
            title: "Actual current source",
            text: "Actual inbox claim",
            publishedAt: null,
            observedAt: Date.now(),
          },
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.render();
  });
  await expect(
    page.getByRole("heading", { name: "Actual inbox claim · Review" }),
  ).toBeVisible();
  await page
    .getByLabel("Übergabeabsicht")
    .fill("Current protected handoff intent");
  await page
    .getByRole("button", { name: "Idea/Draft ausdrücklich übergeben" })
    .click();
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(1);
  const first = await page.evaluate(() => window.commands[0].args);
  expect(first.evidenceIds).toEqual(["evidence-one"]);
  await page.evaluate(() => window.commands[0].reject(new Error("Lost ack")));
  await expect(page.getByLabel("Übergabeabsicht")).toHaveValue(
    "Current protected handoff intent",
  );
  await page
    .getByRole("button", { name: "Inbox-Anfrage erneut bestätigen" })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(first);
  await page.evaluate(() =>
    window.commands[1].resolve([
      {
        ideaId: "actual-idea",
        ideaVersionId: "actual-idea-version",
        draftId: null,
        draftVersionId: null,
      },
    ]),
  );
  await expect(
    page.getByRole("link", { name: "Idea actual-idea" }),
  ).toHaveAttribute("href", "/ideas?idea=actual-idea");
  await page
    .getByRole("button", { name: "Agent zu diesem Beleg fragen" })
    .click();
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(3);
  await page.evaluate(() => window.commands[2].resolve("actual-conversation"));
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(4);
  const attach = await page.evaluate(() => window.commands[3].args);
  expect(attach.conversationId).toBe("actual-conversation");
  expect(attach.evidenceId).toBe("evidence-one");
  await page.evaluate(() =>
    window.commands[3].reject(new Error("Lost attach ack")),
  );
  await page
    .getByRole("button", { name: "Inbox-Anfrage erneut bestätigen" })
    .click();
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(5);
  expect(await page.evaluate(() => window.commands[4].args)).toEqual(attach);
  await page.evaluate(() =>
    window.commands[4].reject(new Error("Still unavailable")),
  );
  await page.evaluate(() => {
    window.inbox.page[0].proofUntil = Date.now() + 100;
    window.render();
  });
  await expect(page.getByLabel("Übergabeabsicht")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Inbox-Anfrage erneut bestätigen" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Aktuelle Version öffnen" }).click();
  await expect(
    page.getByLabel("Automatische Idea/Draft-Übergabe ausdrücklich speichern"),
  ).not.toBeChecked();
  await page
    .getByLabel("Automatische Idea/Draft-Übergabe ausdrücklich speichern")
    .check();
  await page.getByLabel("Maximale automatische Vorschläge").fill("3");
  await page.getByLabel("Automatisches Ziel").selectOption("draft");
  await page
    .getByLabel("Automatische redaktionelle Absicht")
    .fill("Prepare bounded unapproved scheduled drafts");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => window.commands[5].args.action.config.autoHandoff,
    ),
  ).toEqual({
    kind: "bounded-editorial-v1",
    count: 3,
    target: "draft",
    intent: "Prepare bounded unapproved scheduled drafts",
  });
  await page.evaluate(() => {
    window.profile.version.config = window.commands[5].args.action.config;
    window.profile.profile.revision = 3;
    window.commands[5].resolve(3);
    window.inbox.page[0].proofUntil = Date.now() + 60000;
    window.render();
  });
  await page.getByRole("button", { name: "Ignorieren", exact: true }).click();
  const ignored = await page.evaluate(() => window.commands[6].args);
  expect(ignored).toMatchObject({
    evidenceId: "evidence-one",
    expectedRevision: 0,
    disposition: "ignored",
  });
  await page.evaluate(() =>
    window.commands[6].reject(new Error("Lost ignore ack")),
  );
  await page
    .getByRole("button", { name: "Inbox-Anfrage erneut bestätigen" })
    .click();
  expect(await page.evaluate(() => window.commands[7].args)).toEqual(ignored);
  await page.evaluate(() => {
    window.commands[7].resolve(1);
    window.inbox.page[0].inboxRevision = 1;
    window.inbox.page[0].inboxDisposition = "ignored";
    window.render();
  });
  await page.getByRole("button", { name: "Archivieren", exact: true }).click();
  expect(await page.evaluate(() => window.commands[8].args)).toMatchObject({
    evidenceId: "evidence-one",
    expectedRevision: 1,
    disposition: "archived",
  });
  await page.evaluate(() => {
    window.commands[8].resolve(2);
    window.inbox.page[0].inboxRevision = 2;
    window.inbox.page[0].inboxDisposition = "archived";
    window.render();
  });
  await page
    .getByLabel("Neues Recherchethema")
    .fill("Explicit inherited current topic");
  await page
    .getByRole("button", { name: "Aus diesem Beleg neu recherchieren" })
    .click();
  const researched = await page.evaluate(() => window.commands[9].args);
  expect(researched).toMatchObject({
    profileId: "profile-one",
    expectedRevision: 3,
    evidenceId: "evidence-one",
    topic: "Explicit inherited current topic",
    operations: ["web-search"],
  });
  await page.evaluate(() =>
    window.commands[9].reject(new Error("Lost new order ack")),
  );
  await expect(page.getByLabel("Neues Recherchethema")).toHaveValue(
    "Explicit inherited current topic",
  );
  await page
    .getByRole("button", { name: "Inbox-Anfrage erneut bestätigen" })
    .click();
  expect(await page.evaluate(() => window.commands[10].args)).toEqual(
    researched,
  );
  await page.evaluate(() => window.commands[10].resolve("actual-new-order"));
  await expect(
    page.getByText("Neuer tatsächlicher Rechercheauftrag actual-new-order"),
  ).toBeVisible();
  await page.getByLabel("Übergabeabsicht").fill("Pending role epoch handoff");
  await page
    .getByRole("button", { name: "Idea/Draft ausdrücklich übergeben" })
    .click();
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(12);
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect
    .poll(() => page.evaluate(() => window.committedRole))
    .toBe("Viewer");
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await expect
    .poll(() => page.evaluate(() => window.committedRole))
    .toBe("Owner");
  await page.evaluate(() =>
    window.commands[11].resolve([
      {
        ideaId: "stale-role-idea",
        ideaVersionId: "stale-role-version",
        draftId: null,
        draftVersionId: null,
      },
    ]),
  );
  await expect(
    page.getByRole("button", { name: "Idea/Draft ausdrücklich übergeben" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Idea stale-role-idea" }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "Actual Research Inbox React PASS (mocked Convex transport): exact typed IDs, current pagination, stable lost handoff/attach ack, retained create receipt, returned links, ignore/archive/new research/profile options, revoke→restore permission epoch and finite authority dirty buffer expiry. No authenticated/live manual acceptance.",
  );
} finally {
  await browser?.close();
  await server.close();
}
