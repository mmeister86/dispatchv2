import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='research/profiles:get')return window.profile;if(name==='research/profiles:configuration')return window.configuration;if(name==='research/runs:history')return window.orderHistory;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';`,
  "@/lib/store": `import {useState} from 'react';export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[],ideas:[]},createDraft:()=>{throw new Error('No fake real draft');},mutate:()=>{}});`,
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
  await expect(page.getByText("Research-Profil wird geladen …")).toBeVisible();
  await page.evaluate(() => {
    window.profile = null;
    window.render();
  });
  await expect(
    page.getByText(
      "Noch kein Research-Profil. Neue Profile beginnen manuell und ohne Budget.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Weniger Funktionen. Mehr Produkt.")).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Auftrag anlegen" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Profil erstellen", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Themen", exact: true })
    .fill("Buffered topics");
  await page.getByLabel("Zielgruppe", { exact: true }).fill("Builders");
  await expect(page.getByLabel("Häufigkeit")).toHaveValue("manual");
  await expect(
    page.getByLabel("Auftragslimit", { exact: false }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Themen", exact: true }),
  ).toBeDisabled();
  const original = await page.evaluate(() => window.commands[0].args);
  expect(original.config.cap).toBeNull();
  expect(original.config.frequency).toBe("manual");
  await page.evaluate(() =>
    window.commands[0].reject(new Error("synthetic save denied")),
  );
  await expect(
    page.getByRole("textbox", { name: "Themen", exact: true }),
  ).toHaveValue("Buffered topics");
  await expect(page.getByRole("alert")).toContainText("nicht bestätigt");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(original);
  await page.evaluate(() => {
    window.profile = {
      profile: {
        _id: "actual-profile",
        revision: 1,
        paused: false,
        deleted: false,
        scheduleActive: false,
        nextAt: null,
        activeOrderId: null,
      },
      version: {
        _id: "actual-version",
        config: window.commands[1].args.config,
      },
    };
    window.commands[1].resolve("actual-profile");
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Profil speichern", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Nicht verfügbar", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aktuelle Version öffnen" }).click();
  await page
    .getByRole("textbox", { name: "Themen", exact: true })
    .fill("Changed dirty buffer");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  await page.evaluate(() =>
    window.commands[2].reject(new Error("RESEARCH_REVISION_CONFLICT")),
  );
  await expect(page.getByRole("alert")).toContainText("inzwischen geändert");
  await expect(
    page.getByRole("textbox", { name: "Themen", exact: true }),
  ).toHaveValue("Changed dirty buffer");
  await page.getByRole("button", { name: "Bearbeitung schließen" }).click();
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();
  await expect(
    page.getByRole("button", { name: "Auftrag anlegen" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands[3].args)).toMatchObject({
    profileId: "actual-profile",
    expectedRevision: 1,
    workspaceId: "workspace-one",
  });
  await page.evaluate(() => {
    window.commands[3].resolve("actual-order");
    window.profile.profile.activeOrderId = "actual-order";
    window.orderHistory = {
      page: [
        {
          _id: "actual-order",
          createdAt: 1791210000000,
          occasion: "manual",
          state: "queued",
          config: { topics: "Buffered topics" },
          profileVersionId: "actual-version",
          reason: null,
        },
      ],
      isDone: false,
      continueCursor: "actual-cursor",
    };
    window.render();
  });
  await expect(
    page.getByText("Auftrag wartet auf Prüfung", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Auftrag stoppen" }).click();
  expect(await page.evaluate(() => window.commands[4].args)).toEqual({
    workspaceId: "workspace-one",
    orderId: "actual-order",
  });
  await page.evaluate(() =>
    window.commands[4].reject(new Error("stop denied")),
  );
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Auftrag stoppen" }).click();
  await page.evaluate(() => {
    window.commands[5].resolve(null);
    window.orderHistory.page[0].state = "cancelled";
    window.orderHistory.page[0].reason = "RESEARCH_STOPPED";
    window.profile.profile.activeOrderId = null;
    window.render();
  });
  await expect(
    page.getByText("RESEARCH_STOPPED", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ältere Aufträge" }).click();
  expect(
    await page.evaluate(
      () =>
        window.queries.filter((q) => q.name === "research/runs:history").at(-1)
          .args.paginationOpts.cursor,
    ),
  ).toBe("actual-cursor");
  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await page.evaluate(() =>
    window.commands[6].reject(new Error("late role failure")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Aktuelle Version öffnen" }),
  ).toBeDisabled();
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await page.getByRole("button", { name: "Aktuelle Version öffnen" }).click();
  await page
    .getByRole("textbox", { name: "Themen", exact: true })
    .fill("Old account buffer");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  await page.evaluate(() => {
    window.account = "account-two";
    window.profile = null;
    window.render();
  });
  await page.evaluate(() => window.commands[7].resolve(2));
  await expect(
    page.getByRole("textbox", { name: "Themen", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Profil erstellen", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Themen", exact: true })
    .fill("Old workspace buffer");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  await page.evaluate(() => {
    window.workspace = "workspace-two";
    window.profile = null;
    window.render();
  });
  await page.evaluate(() =>
    window.commands[8].reject(new Error("late workspace failure")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Themen", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.account = "";
    window.render();
  });
  await expect(
    page.getByText("Account auswählen", { exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5174/research-fixture");
  await page.evaluate(() => {
    window.profile = {
      profile: {
        _id: "priced-profile",
        revision: 4,
        paused: false,
        deleted: false,
        scheduleActive: false,
        nextAt: null,
        activeOrderId: null,
      },
      version: {
        config: {
          topics: "Priced profile",
          project: "",
          audience: "Builders",
          languages: ["de"],
          regions: [],
          preferredSources: [],
          exclusions: "",
          freshnessDays: 7,
          topicCount: 5,
          frequency: "daily",
          timeZone: "Europe/Berlin",
          clock: "09:00",
          weekday: 1,
          cap: { currency: "USD", limitMicros: 10000 },
          autoHandoff: false,
        },
      },
    };
    window.render();
  });
  await page.getByRole("button", { name: "Aktuelle Version öffnen" }).click();
  await expect(page.getByLabel("Auftragslimit USD")).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Themen", exact: true })
    .fill("First priced edit");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  const priced = await page.evaluate(() => window.commands[0].args);
  expect(priced.action.config.cap).toEqual({
    currency: "USD",
    limitMicros: 10000,
  });
  await page.evaluate(() =>
    window.commands[0].reject(new Error("network failure")),
  );
  await page
    .getByRole("textbox", { name: "Themen", exact: true })
    .fill("New buffer after failure");
  await page.evaluate(() => {
    window.profile.profile.revision = 5;
    window.render();
  });
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(priced);
  await page.evaluate(() => window.commands[1].resolve(5));
  await expect(
    page.getByRole("textbox", { name: "Themen", exact: true }),
  ).toHaveValue("New buffer after failure");
  await page.evaluate(() => {
    window.configuration = { currency: "EUR", downstreamAvailable: false };
    window.render();
  });
  await expect(page.getByLabel("Auftragslimit USD")).toBeDisabled();
  await page.getByRole("button", { name: "Auftragslimit entfernen" }).click();
  await page.getByLabel("Auftragslimit EUR").fill("0.012345");
  await page
    .getByRole("button", { name: "Profil speichern", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.commands[2].args)).action.config.cap,
  ).toEqual({ currency: "EUR", limitMicros: 12345 });
  await page.evaluate(() =>
    window.commands[2].reject(new Error("RESEARCH_REVISION_CONFLICT")),
  );
  await page.getByRole("button", { name: "Bearbeitung schließen" }).click();
  await page
    .getByRole("button", { name: "Zeitplan ausdrücklich aktivieren" })
    .click();
  expect((await page.evaluate(() => window.commands[3].args)).action).toEqual({
    kind: "activate",
  });
  await page.evaluate(() =>
    window.commands[3].reject(
      new Error("RESEARCH_BUDGET_CONFIGURATION_REQUIRED"),
    ),
  );
  await expect(page.getByRole("alert")).toContainText("Accountdeckung");
  await page.goto("http://127.0.0.1:5174/research-fixture?demo=1");
  await expect(
    page.getByText("Weniger Funktionen. Mehr Produkt.").first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Actual ResearchPage real/Demo: empty/no fake data, manual default/no cap, deferred ack/error/exact retry/CAS buffer, actual order/stop/paged history, late role/account/workspace/unmount PASS; no provider call.",
  );
} finally {
  await browser?.close();
  await server.close();
}
