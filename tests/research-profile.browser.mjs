import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='research/profiles:get')return window.profile;if(name==='research/profiles:configuration')return window.configuration;if(name==='research/runs:history')return window.orderHistory;if(name==='research/native:availability')return window.sourceAvailability??[];if(name==='research/native:results')return window.sourceResults??[];};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));`,
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
    .getByRole("button", {
      name: "Ursprüngliche Anfrage wiederholen",
      exact: true,
    })
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
  await page
    .getByRole("button", { name: "Wiederholungsoption verwerfen" })
    .click();
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
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, activeOrderId: "actual-order" },
    };
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
  await page
    .getByRole("button", {
      name: "Ursprüngliche Anfrage wiederholen",
      exact: true,
    })
    .click();
  await page.evaluate(() => {
    window.commands[5].resolve(null);
    window.orderHistory = {
      ...window.orderHistory,
      page: window.orderHistory.page.map((o) => ({
        ...o,
        state: "cancelled",
        reason: "RESEARCH_STOPPED",
      })),
    };
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, activeOrderId: null },
    };
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
  await expect(
    page.getByRole("button", { name: "Aktuelle Version öffnen" }),
  ).toBeDisabled();
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
  await page
    .getByRole("button", { name: "Wiederholungsoption verwerfen" })
    .click();
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
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 5 },
    };
    window.render();
  });
  await page
    .getByRole("button", {
      name: "Ursprüngliche Anfrage wiederholen",
      exact: true,
    })
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
    .getByRole("button", { name: "Wiederholungsoption verwerfen" })
    .click();
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
  async function acknowledgedProfile() {
    await page.goto("http://127.0.0.1:5174/research-fixture");
    await page.evaluate(() => {
      window.profile = {
        profile: {
          _id: "ack-profile",
          revision: 3,
          paused: false,
          deleted: false,
          scheduleActive: false,
          nextAt: null,
          activeOrderId: null,
        },
        version: {
          config: {
            topics: "ACK profile",
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
            cap: null,
            autoHandoff: false,
          },
        },
      };
      window.render();
    });
  }
  const retry = page.getByRole("button", {
    name: "Ursprüngliche Anfrage wiederholen",
    exact: true,
  });
  await acknowledgedProfile();
  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  const firstPause = await page.evaluate(() => window.commands[0].args);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 4, paused: true },
    };
    window.commands[0].reject(new Error("lost pause ACK"));
    window.render();
  });
  await expect(retry).toBeVisible();
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(retry).toBeDisabled();
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await retry.click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(
    firstPause,
  );
  await page.evaluate(() => window.commands[1].resolve(4));
  await page
    .getByRole("button", { name: "Pause aufheben", exact: true })
    .click();
  const unpause = await page.evaluate(() => window.commands[2].args);
  expect(unpause.expectedRevision).toBe(4);
  expect(unpause.commandKey).not.toBe(firstPause.commandKey);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 5, paused: false },
    };
    window.commands[2].resolve(5);
    window.render();
  });
  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  const laterPause = await page.evaluate(() => window.commands[3].args);
  expect(laterPause.expectedRevision).toBe(5);
  expect(laterPause.commandKey).not.toBe(firstPause.commandKey);
  expect(laterPause.action).toEqual({ kind: "pause", paused: true });
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 6, paused: true },
    };
    window.commands[3].resolve(6);
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Pause aufheben", exact: true }),
  ).toBeVisible();
  await acknowledgedProfile();
  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  const abandonedPause = await page.evaluate(() => window.commands[0].args);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 4, paused: true },
    };
    window.commands[0].reject(new Error("lost abandoned pause ACK"));
    window.render();
  });
  await expect(retry).toBeVisible();
  await page
    .getByRole("button", { name: "Wiederholungsoption verwerfen" })
    .click();
  await page
    .getByRole("button", { name: "Pause aufheben", exact: true })
    .click();
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 5, paused: false },
    };
    window.commands[1].resolve(5);
    window.render();
  });
  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  const afterAbandon = await page.evaluate(() => window.commands[2].args);
  expect(afterAbandon.expectedRevision).toBe(5);
  expect(afterAbandon.commandKey).not.toBe(abandonedPause.commandKey);
  await page.evaluate(() => window.commands[2].resolve(6));
  await acknowledgedProfile();
  await page
    .getByRole("button", { name: "Zeitplan ausdrücklich aktivieren" })
    .click();
  const firstActivation = await page.evaluate(() => window.commands[0].args);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: {
        ...window.profile.profile,
        revision: 4,
        scheduleActive: true,
        nextAt: 1791289800000,
      },
    };
    window.commands[0].reject(new Error("lost activation ACK"));
    window.render();
  });
  await expect(retry).toBeVisible();
  await retry.click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(
    firstActivation,
  );
  await page.evaluate(() => window.commands[1].resolve(4));
  await page.getByRole("button", { name: "Zeitplan deaktivieren" }).click();
  expect(
    (await page.evaluate(() => window.commands[2].args)).expectedRevision,
  ).toBe(4);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: {
        ...window.profile.profile,
        revision: 5,
        scheduleActive: false,
        nextAt: null,
      },
    };
    window.commands[2].resolve(5);
    window.render();
  });
  await page
    .getByRole("button", { name: "Zeitplan ausdrücklich aktivieren" })
    .click();
  const laterActivation = await page.evaluate(() => window.commands[3].args);
  expect(laterActivation.expectedRevision).toBe(5);
  expect(laterActivation.commandKey).not.toBe(firstActivation.commandKey);
  await page.evaluate(() => window.commands[3].resolve(6));
  await acknowledgedProfile();
  await page.getByRole("button", { name: "Profil löschen" }).click();
  const deleted = await page.evaluate(() => window.commands[0].args);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 4, deleted: true },
    };
    window.commands[0].reject(new Error("lost delete ACK"));
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Profil löschen" }),
  ).toHaveCount(0);
  await expect(retry).toBeEnabled();
  await retry.click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(deleted);
  await page.evaluate(() => window.commands[1].resolve(4));
  await expect(retry).toHaveCount(0);
  await expect(
    page.getByText("Gelöscht · historischer Beleg bleibt erhalten", {
      exact: false,
    }),
  ).toBeVisible();
  await acknowledgedProfile();
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();
  const admitted = await page.evaluate(() => window.commands[0].args);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, activeOrderId: "committed-order" },
    };
    window.commands[0].reject(new Error("lost start ACK"));
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Auftrag anlegen" }),
  ).toBeDisabled();
  await expect(retry).toBeEnabled();
  await retry.click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(admitted);
  await page.evaluate(() => window.commands[1].resolve("committed-order"));
  await expect(retry).toHaveCount(0);
  await page.evaluate(() => {
    window.orderHistory = {
      page: [
        {
          _id: "committed-order",
          createdAt: 1791210000000,
          occasion: "manual",
          state: "queued",
          config: { topics: "ACK profile" },
          reason: null,
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.render();
  });
  await page.getByRole("button", { name: "Auftrag stoppen" }).click();
  const stopped = await page.evaluate(() => window.commands[2].args);
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, activeOrderId: null },
    };
    window.orderHistory = {
      ...window.orderHistory,
      page: window.orderHistory.page.map((o) => ({
        ...o,
        state: "cancelled",
        reason: "RESEARCH_STOPPED",
      })),
    };
    window.commands[2].reject(new Error("lost stop ACK"));
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Auftrag stoppen" }),
  ).toHaveCount(0);
  await expect(retry).toBeEnabled();
  await retry.click();
  expect(await page.evaluate(() => window.commands[3].args)).toEqual(stopped);
  await page.evaluate(() => window.commands[3].resolve(null));
  await expect(retry).toHaveCount(0);
  await page.getByRole("button", { name: "Auftrag anlegen" }).click();
  const laterOrder = await page.evaluate(() => window.commands[4].args);
  expect(laterOrder.operationKey).not.toBe(admitted.operationKey);
  expect(laterOrder.expectedRevision).toBe(3);
  await page.evaluate(() => window.commands[4].resolve("later-order"));
  await acknowledgedProfile();
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      version: {
        config: {
          ...window.profile.version.config,
          cap: { currency: "USD", limitMicros: 300 },
        },
      },
    };
    window.sourceAvailability = [
      {
        operation: "x-trends",
        state: "configuration_required",
        currency: null,
        reason: "Keine aktuelle Trendberechtigung; keine Live-Trends.",
      },
      {
        operation: "web-search",
        state: "available",
        currency: "USD",
        reason: "Synthetisch aktuell freigegeben.",
      },
    ];
    window.render();
  });
  await expect(
    page.getByText("Keine aktuelle Trendberechtigung; keine Live-Trends.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Suchanfrage", { exact: true })
    .fill("Buffered public query");
  await page
    .getByRole("button", { name: "Quellensuche ausdrücklich starten" })
    .click();
  const nativeIntent = await page.evaluate(() => window.commands[0].args);
  expect(nativeIntent).toMatchObject({
    query: "Buffered public query",
    language: "de",
    operations: ["web-search"],
    expectedRevision: 3,
  });
  await expect(page.getByLabel("Suchanfrage", { exact: true })).toBeDisabled();
  await page.evaluate(() =>
    window.commands[0].reject(new Error("lost native ACK")),
  );
  await expect(retry).toBeVisible();
  await page.evaluate(() => {
    window.profile = {
      ...window.profile,
      profile: { ...window.profile.profile, revision: 4 },
    };
    window.render();
  });
  await retry.click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(
    nativeIntent,
  );
  await page.evaluate(() => {
    window.sourceResults = [
      {
        operation: "x-recent",
        state: "unknown",
        reason: "RESEARCH_PROVIDER_UNAVAILABLE",
        cacheHit: false,
        query: "Buffered public query",
        language: "de",
        provider: "x",
        protocol: "x-post-fields-v2",
        policyVersion: "synthetic-v1",
        model: null,
        windowStart: Date.now() - 7 * 86400000,
        windowEnd: Date.now(),
        truncated: false,
        sources: [],
        estimatedMicros: null,
        currency: "USD",
        usagePending: true,
        billedMicros: null,
      },
      {
        operation: "web-search",
        state: "partial",
        reason: "RESEARCH_STREAM_INCOMPLETE",
        cacheHit: false,
        query: "Buffered public query",
        language: "de",
        provider: "requesty",
        protocol: "requesty-chat-web-search-v1",
        policyVersion: "synthetic-v1",
        model: "synthetic/model",
        windowStart: Date.now() - 86400000,
        windowEnd: Date.now(),
        truncated: false,
        sources: [
          {
            sourceId: "source-one",
            operation: "web-search",
            url: "https://example.test/actual",
            title: "Actual delivered source",
            text: "CURRENT_SOURCE_TEXT",
            publishedAt: null,
            count: null,
            observedAt: Date.now(),
            usableUntil: Date.now() + 2500,
          },
        ],
        estimatedMicros: null,
        currency: "USD",
        usagePending: true,
        billedMicros: null,
      },
    ];
    window.commands[1].resolve("native-order");
    window.render();
  });
  await expect(
    page.getByRole("link", { name: "Actual delivered source" }),
  ).toHaveAttribute("href", "https://example.test/actual");
  await expect(
    page.getByText("CURRENT_SOURCE_TEXT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Websuche · partial", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Vorläufige Schätzung 0 USD", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Quelle abgelaufen; Inhalt ausgeblendet."),
  ).toBeVisible();
  await expect(
    page.getByText("CURRENT_SOURCE_TEXT", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Actual delivered source" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Suchanfrage", { exact: true })
    .fill("New explicit query");
  await page
    .getByRole("button", { name: "Quellensuche ausdrücklich starten" })
    .click();
  const nextNative = await page.evaluate(() => window.commands[2].args);
  expect(nextNative.expectedRevision).toBe(4);
  expect(nextNative.operationKey).not.toBe(nativeIntent.operationKey);
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
    window.commands[2].reject(new Error("late native role failure"));
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Quellensuche ausdrücklich starten" }),
  ).toBeDisabled();
  await page.goto("http://127.0.0.1:5174/research-fixture?demo=1");
  await expect(
    page.getByText("Weniger Funktionen. Mehr Produkt.").first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Actual ResearchPage real/Demo PASS: empty/manual/no cap, saved ACK/error/CAS/currency/dirty buffers, exact explicit retries after lost pause/activation/delete/start/stop ACKs, fresh intent keys/revisions after retry or discard, Viewer/late role/account/workspace/unmount fences, actual order/paging; no provider call.",
  );
} finally {
  await browser?.close();
  await server.close();
}
