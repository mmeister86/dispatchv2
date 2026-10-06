import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='intelligence/profiles:get')return window.profile;if(name==='intelligence/profiles:history')return window.historyRows;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useAction=()=>()=>{throw new Error("No live action in profile fixture");};`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';`,
  "@/lib/store": `import {useState,useEffect} from 'react';export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>{const role=window.role;useEffect(()=>{window.committedRole=role;},[role]);return {state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role,accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[],ideas:[],schedules:[],preferences:{audience:'Personal preference'}},mutate:()=>{}};};`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {OperationsPage} from '/src/pages/Operations.tsx';import {IntelligenceProfiles} from '/src/features/intelligence/profiles.tsx';window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.queries=[];window.commands=[];window.profile=undefined;window.historyRows={page:[],isDone:true,continueCursor:''};window.view='operations';const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,window.view==='operations'?React.createElement(OperationsPage):React.createElement(IntelligenceProfiles,{readOnly:window.view==='readonly',audienceOnly:window.view==='audience'}))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/intelligence-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "intelligence-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0intelligence-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/intelligence-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__intelligence-entry"></script>',
            ),
          );
        });
      },
    },
  ],
});
await server.listen();
let browser;
const empty = {
  selection: null,
  algorithms: [],
  audiences: [],
  capture: {
    revision: 0,
    algorithmId: null,
    audienceId: null,
    refs: null,
    usable: false,
    missing: ["algorithm", "audience", "embedding", "analysis"],
    aggregate: null,
    audienceFit: "unavailable",
    history: { value: 0.5, basis: "assumed_cold_start_baseline" },
  },
};
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
  await page.goto("http://127.0.0.1:5174/intelligence-fixture");
  await page.getByRole("tab", { name: "Algorithmusprofile" }).click();
  await expect(
    page.getByText("Intelligence-Profile werden geladen …"),
  ).toBeVisible();
  await page.evaluate((data) => {
    window.profile = data;
    window.render();
  }, empty);
  await expect(
    page.getByText(
      "Profilkontext unvollständig oder erneute Prüfung erforderlich.",
    ),
  ).toBeVisible();
  await page
    .getByLabel("Deklarierte Account-Zielgruppe")
    .fill("Buffered account context");
  await page
    .getByRole("button", { name: "Neue Zielgruppen-Version speichern" })
    .click();
  await expect(
    page.getByLabel("Deklarierte Account-Zielgruppe"),
  ).toBeDisabled();
  const original = await page.evaluate(() => window.commands[0].args);
  expect(original.description).toBe("Buffered account context");
  expect(original.expectedRevision).toBe(0);
  await page.evaluate(() =>
    window.commands[0].reject(new Error("INTELLIGENCE_REVISION_CONFLICT")),
  );
  await expect(page.getByRole("alert")).toContainText("Revision");
  await expect(page.getByLabel("Deklarierte Account-Zielgruppe")).toHaveValue(
    "Buffered account context",
  );
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(original);
  await page.evaluate(() =>
    window.commands[1].resolve({
      revision: 1,
      audienceId: "audience-one",
      algorithmId: null,
    }),
  );
  await expect(page.getByLabel("Deklarierte Account-Zielgruppe")).toHaveValue(
    "",
  );
  await page
    .getByLabel("Deklarierte Account-Zielgruppe")
    .fill("Do not clear late ACK");
  await page
    .getByRole("button", { name: "Neue Zielgruppen-Version speichern" })
    .click();
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(
    page.getByText("Owner/Admin-Rechte für Profiländerungen erforderlich."),
  ).toBeVisible();
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await expect(
    page.getByText("Owner/Admin-Rechte für Profiländerungen erforderlich."),
  ).toHaveCount(0);
  await page.evaluate(() =>
    window.commands[2].resolve({
      revision: 2,
      audienceId: "audience-two",
      algorithmId: null,
    }),
  );
  await expect(page.getByLabel("Deklarierte Account-Zielgruppe")).toHaveValue(
    "Do not clear late ACK",
  );
  await expect(
    page.getByText("Aktion bestätigt.", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Neue Zielgruppen-Version speichern" })
    .click();
  await page.evaluate(() => {
    window.account = "account-two";
    window.render();
  });
  await expect(page.getByLabel("Deklarierte Account-Zielgruppe")).toHaveValue(
    "",
  );
  await page
    .getByLabel("Deklarierte Account-Zielgruppe")
    .fill("New account buffer");
  await page.evaluate(() =>
    window.commands[3].resolve({
      revision: 3,
      audienceId: "old-account",
      algorithmId: null,
    }),
  );
  await expect(page.getByLabel("Deklarierte Account-Zielgruppe")).toHaveValue(
    "New account buffer",
  );
  await page.evaluate(() => {
    window.view = "readonly";
    window.render();
  });
  await expect(
    page.getByText("Intelligence-Profile", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Neue Zielgruppen-Version speichern" }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      /Kein Gesamtscore; Audience Fit und Embeddings nicht verfügbar/,
    ),
  ).toBeVisible();
  await page.evaluate(() => {
    window.view = "audience";
    window.render();
  });
  await expect(
    page.getByText("Versionierte Account-Zielgruppe", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Öffentlichen Snapshot als Kandidat anlegen",
    }),
  ).toHaveCount(0);
  await page.evaluate((data) => {
    window.view = "profile";
    window.profile = {
      ...data,
      algorithms: [
        {
          _id: "algorithm-one",
          status: "draft",
          review: null,
          payload: {
            version: "x-public-context-v1",
            reviewDueAt: Date.parse("2026-10-12T00:00:00Z"),
            evidence: [],
          },
        },
      ],
    };
    window.render();
  }, empty);
  await page.getByLabel("Entscheidungsgrund").fill("Explicit source review");
  await page.getByRole("button", { name: "Quellenprofil prüfen" }).click();
  const reviewInput = await page.evaluate(() => window.commands.at(-1).args);
  expect(reviewInput.action).toEqual({
    kind: "review-algorithm",
    algorithmId: "algorithm-one",
    reason: "Explicit source review",
  });
  await expect(page.getByText(/algorithm-one · draft/)).toBeVisible();
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ revision: 1, algorithmId: "algorithm-one", audienceId: null }),
  );
  await page.evaluate(() => {
    window.profile.algorithms[0].status = "reviewed";
    window.profile.algorithms[0].review = {
      at: Date.now(),
      reason: "Explicit source review",
    };
    window.profile.capture.revision = 1;
    window.render();
  });
  await page.getByLabel("Algorithmus-Version").selectOption("algorithm-one");
  await page
    .getByRole("button", { name: "Auswahl ausdrücklich aktivieren" })
    .click();
  const selectionInput = await page.evaluate(() => window.commands.at(-1).args);
  expect(selectionInput.action).toEqual({
    kind: "select",
    algorithmId: "algorithm-one",
    audienceId: null,
    reason: "Explicit source review",
  });
  expect(selectionInput.expectedRevision).toBe(1);
  await expect(page.getByText(/Algorithmus: nicht ausgewählt/)).toBeVisible();
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .reject(new Error("INTELLIGENCE_CURRENT_REVIEW_REQUIRED")),
  );
  await expect(page.getByRole("alert")).toContainText("Aktuelle Prüfung");
  await expect(page.getByLabel("Entscheidungsgrund")).toHaveValue(
    "Explicit source review",
  );
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toEqual(
    selectionInput,
  );
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ revision: 2, algorithmId: "algorithm-one", audienceId: null }),
  );
  await page.evaluate(() => {
    window.profile.capture.algorithmId = "algorithm-one";
    window.profile.algorithms[0].payload.reviewDueAt = Date.parse(
      "2026-10-01T00:00:00Z",
    );
    window.render();
  });
  await expect(
    page.getByText(
      "Quellenprüfung fällig. Profilkontext nicht aktuell nutzbar.",
    ),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5174/intelligence-fixture?demo=1");
  await page.getByRole("tab", { name: "Algorithmusprofile" }).click();
  await expect(
    page.getByRole("button", {
      name: "Öffentlichen Snapshot als Kandidat anlegen",
    }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.queries.some((q) => q.name.startsWith("intelligence/")),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  console.log(
    "PASS: actual Operations profile tab, declared audience/read-only controls, exact retry, role withdrawal/restoration and account late ACK guards; registered mock transport, no live backend or analyzer.",
  );
} finally {
  await browser?.close();
  await server.close();
}
