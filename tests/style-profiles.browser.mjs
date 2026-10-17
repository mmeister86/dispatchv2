import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const evidence = `${artifactDir}/dispatch-task45.1-evidence`;
mkdirSync(evidence, { recursive: true });
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useConvex=()=>({});export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='ai/styleProfiles:get')return {...window.profile,versions:window.profile.versions.map(({_id,_creationTime,status,declaredBy,declaredAt,createdBy,createdAt})=>({_id,_creationTime,status,declaredBy,declaredAt,createdBy,createdAt})),proposals:window.profile.proposals.map(({_id,state})=>({_id,state}))};if(name==='ai/styleProfiles:version')return window.detailLoading?undefined:window.profile.versions.find(v=>v._id===args.versionId);if(name==='ai/styleProfiles:receipt')return window.detailLoading?undefined:window.styleHistory.page.find(r=>r._id===args.receiptId);if(name==='ai/styleProfiles:history')return {...window.styleHistory,page:window.styleHistory.page.map(({_id,_creationTime,revision,action,versionId,proposalId,createdAt})=>({_id,_creationTime,revision,action,versionId,proposalId,createdAt}))};if(name==='ai/styleProfiles:inspect')return window.inspection;if(name==='content/feedback:list')return window.feedback;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useAction=useMutation;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const authClient={};`,
  "@/lib/store": `import {useState} from 'react';export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,accounts:[{id:'account-one',workspaceId:window.workspace,name:'Synthetic',channel:'X'},{id:'account-two',workspaceId:window.workspace,name:'Other',channel:'X'}],drafts:[],ideas:[],schedules:[],preferences:{audience:'Personal preference'}},mutate:()=>{}});`,
};
const entry = `import '/src/index.css';import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,Routes,Route} from 'react-router-dom';import {SettingsPage} from '/src/pages/Settings.tsx';window.workspace='workspace-one';window.account=null;window.role='Owner';window.queries=[];window.commands=[];window.profile={control:null,versions:[],proposals:[],usable:false};window.styleHistory={page:[],isDone:true,continueCursor:''};window.feedback=[];window.inspection=undefined;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{initialEntries:['/settings/strategy']},React.createElement(Routes,null,React.createElement(Route,{path:'/settings/:tab',element:React.createElement(SettingsPage)})))));window.render();`;
const server = await createServer({
  root,
  configFile: root + "/vite.config.ts",
  cacheDir: `${artifactDir}/dispatch-task45.1-vite`,
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
  plugins: [
    {
      name: "style-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(root + "/src/lib/store"))
          return "\0fixture:@/lib/store";
        if (id.startsWith(root + "/src/lib/auth-client"))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return "\0fixture:" + id;
      },
      load(id) {
        if (id === "\0style-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/style-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__style-entry"></script>',
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
    viewport: { width: 1280, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5178/style-fixture");
  await expect(
    page.getByText("Account für Stilprofil auswählen.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.queries.some((x) => x.name.startsWith("ai/styleProfiles")),
    ),
  ).toBe(false);
  await page.evaluate(() => {
    window.account = "account-one";
    window.render();
  });
  await expect(
    page.getByLabel("Deklarierter Autor (unverifizierte Anzeige)"),
  ).toBeVisible();
  await page
    .getByLabel("Deklarierter Autor (unverifizierte Anzeige)")
    .fill("Buffered author");
  await page.getByLabel("Säule 1").fill("Product");
  await page.getByLabel("Gewünschter Ton").fill("Buffered tone");
  await page.getByLabel("Entscheidungsgrund").fill("Explicit human input");
  await page
    .getByLabel(
      "Ich erkläre diese Angaben als eigene autorisierte Eingabe für diesen Account.",
    )
    .check();
  await page
    .getByRole("button", { name: "Neue Version speichern", exact: true })
    .click();
  await expect(page.getByLabel("Gewünschter Ton")).toBeDisabled();
  const original = await page.evaluate(() => window.commands[0].args);
  expect(original.action.payload.author).toBe("Buffered author");
  await page.evaluate(() =>
    window.commands[0].reject(new Error("STYLE_REVISION_CONFLICT")),
  );
  await expect(page.getByRole("alert")).toContainText("Revision");
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("Buffered tone");
  await page.evaluate(() => {
    window.profile.control = { revision: 3, selectedVersionId: null };
    window.render();
  });
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(original);
  await page.evaluate(() =>
    window.commands[1].resolve({ revision: 1, versionId: "version-one" }),
  );
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("Buffered tone");
  await expect(page.getByRole("status")).toContainText("bestätigt");
  await page
    .getByRole("button", { name: "Neue Version speichern", exact: true })
    .click();
  await page.evaluate(() =>
    window.commands[2].reject(new Error("STYLE_REVISION_CONFLICT")),
  );
  await page
    .getByRole("button", { name: "Aktuelle Revision übernehmen" })
    .click();
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("Buffered tone");
  await page
    .getByRole("button", { name: "Neue Version speichern", exact: true })
    .click();
  expect(
    await page.evaluate(() => window.commands[3].args.expectedRevision),
  ).toBe(3);
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(page.getByLabel("Gewünschter Ton")).toBeDisabled();
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
    window.commands[3].resolve({ revision: 4, versionId: "late-version" });
  });
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("Buffered tone");
  await page
    .getByRole("button", { name: "Neue Version speichern", exact: true })
    .click();
  await page.evaluate(() => {
    window.account = "account-two";
    window.render();
  });
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("");
  await page.evaluate(() =>
    window.commands[4].reject(new Error("late error for previous account")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.evaluate(() => {
    const payload = {
      author: "Stored human assertion",
      experiences: ["Explicit unverified experience"],
      tone: "Stored tone",
      positioning: "Stored position",
      pillars: [{ name: "Product", weight: 100 }],
      examples: ["Example is not biography"],
      forbidden: [],
    };
    window.version = {
      _id: "version-with-a-long-actual-shaped-identifier-for-overflow",
      status: "active",
      payload,
      createdBy: "creator",
      declaredBy: "declarer",
      declaredAt: Date.now(),
      sourceUntil: null,
      sourceUnavailable: false,
      reason: "Original version reason",
    };
    window.profile = {
      control: { revision: 5, selectedVersionId: window.version._id },
      versions: [window.version],
      proposals: [],
      usable: true,
    };
    window.feedback = [
      {
        _id: "exact-feedback",
        kind: "edit",
        sourceUntil: null,
        sourceUnavailable: false,
      },
    ];
    window.styleHistory = {
      page: [
        {
          _id: "selection-receipt",
          revision: 5,
          action: "select",
          versionId: window.version._id,
          reason: "Original explicit selection",
          sourceUnavailable: false,
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.render();
  });
  await page.evaluate(() => {
    window.detailLoading = true;
    window.render();
  });
  await expect(
    page.getByText("Stilversion wird geladen …", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Entscheidung wird geladen …", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Geschützter Profilinhalt nicht verfügbar.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.detailLoading = false;
    window.render();
  });
  await expect(
    page.getByText("Original explicit selection", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.queries.some(
        (q) =>
          q.name === "ai/styleProfiles:version" &&
          q.args.versionId === window.version._id &&
          q.args.accountId === window.account,
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      window.queries.some(
        (q) =>
          q.name === "ai/styleProfiles:receipt" &&
          q.args.receiptId === "selection-receipt" &&
          q.args.accountId === window.account,
      ),
    ),
  ).toBe(true);
  await page
    .getByLabel("Entscheidungsgrund")
    .fill("Reviewable explicit decision");
  await page
    .getByRole("button", { name: "Kopie in Eingaben übernehmen", exact: true })
    .click();
  await expect(
    page.getByLabel("Deklarierter Autor (unverifizierte Anzeige)"),
  ).toHaveValue("Stored human assertion");
  await expect(
    page.getByLabel("Deklarierter Autor (unverifizierte Anzeige)"),
  ).toBeDisabled();
  await page.getByLabel("Gewünschter Ton").fill("Human proposed tone");
  await page
    .getByRole("combobox", { name: /Feedback-Ereignis/ })
    .selectOption("exact-feedback");
  await page
    .getByLabel(
      "Ich autorisiere diese Textbeispiele ausdrücklich als eigene Account-Beispiele.",
    )
    .check();
  await page
    .getByRole("button", { name: "Korrekturvorschlag speichern", exact: true })
    .click();
  const proposed = await page.evaluate(
    () => window.commands.at(-1).args.action,
  );
  expect(proposed.kind).toBe("propose");
  expect(proposed.feedbackId).toBe("exact-feedback");
  expect(proposed.preferences.author).toBeUndefined();
  expect(proposed.preferences.experiences).toBeUndefined();
  await page.evaluate(() => {
    window.commands.at(-1).resolve({ revision: 6 });
    window.proposal = {
      _id: "proposal-one",
      state: "pending",
      preferences: window.commands.at(-1).args.action.preferences,
      feedbackId: "exact-feedback",
      beforeVersionId: "before-exact",
      resultingVersionId: "result-exact",
      reason: "Human correction reason",
      decisionReason: "",
      sourceUnavailable: false,
      sourceUntil: null,
    };
    window.profile.proposals = [window.proposal];
    window.inspection = {
      proposal: window.proposal,
      base: window.version,
      before: "Exact original text",
      after: "Exact result text",
    };
    window.render();
  });
  await page
    .getByRole("combobox", { name: /Gespeicherter Korrekturvorschlag/ })
    .selectOption("proposal-one");
  await expect(
    page.getByText("Vorgeschlagener Ton: Human proposed tone", { exact: true }),
  ).toBeVisible();
  await page
    .getByText(
      "Exakte vorherige und resultierende Textversion (Ausschnitt bis 4000 Zeichen)",
      { exact: true },
    )
    .click();
  await expect(
    page.getByText("Exact original text", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Exact result text", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Annehmen und neue Version erzeugen",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args.action)).toEqual(
    {
      kind: "accept",
      proposalId: "proposal-one",
      reason: "Reviewable explicit decision",
    },
  );
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ revision: 7, versionId: "accepted-version" }),
  );
  await expect(
    page.getByText("Original explicit selection", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Auf diese Auswahl zurückrollen",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args.action)).toEqual(
    {
      kind: "rollback",
      receiptId: "selection-receipt",
      reason: "Reviewable explicit decision",
    },
  );
  await page.evaluate(() => window.commands.at(-1).resolve({ revision: 8 }));
  await page
    .getByRole("button", { name: "Diese Version auswählen", exact: true })
    .click();
  expect(
    (await page.evaluate(() => window.commands.at(-1).args.action)).kind,
  ).toBe("select");
  await page.evaluate(() => window.commands.at(-1).resolve({ revision: 9 }));
  await page.screenshot({
    path: evidence + "/settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Gewünschter Ton")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: evidence + "/settings-390.png",
    fullPage: true,
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: evidence + "/settings-390-top.png" });
  await page
    .getByRole("button", { name: "Diese Version auswählen", exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Diese Version auswählen", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: evidence + "/settings-390-versions.png" });
  await page
    .getByRole("button", {
      name: "Annehmen und neue Version erzeugen",
      exact: true,
    })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", {
      name: "Annehmen und neue Version erzeugen",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: evidence + "/settings-390-proposal.png" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  // A saved proposal from another session must be reviewed independently of the empty input buffer.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.evaluate(() => {
    window.account = "account-one";
    window.version = {
      ...window.version,
      payload: {
        author: "Separate stored assertion",
        experiences: ["Separate stored experience"],
        tone: "Original stored tone",
        positioning: "Original stored position",
        pillars: [{ name: "ORIGINAL REVIEW PILLAR", weight: 100 }],
        examples: ["ORIGINAL REVIEW EXAMPLE"],
        forbidden: ["ORIGINAL REVIEW FORBIDDEN"],
      },
    };
    window.proposal = {
      ...window.proposal,
      _id: "saved-independent-proposal",
      preferences: {
        tone: "PROPOSED REVIEW TONE",
        positioning: "PROPOSED REVIEW POSITION",
        pillars: [{ name: "PROPOSED REVIEW PILLAR", weight: 100 }],
        examples: ["PROPOSED REVIEW EXAMPLE"],
        forbidden: ["PROPOSED REVIEW FORBIDDEN"],
      },
    };
    window.profile = {
      control: { revision: 10, selectedVersionId: window.version._id },
      versions: [window.version],
      proposals: [window.proposal],
      usable: true,
    };
    window.inspection = {
      proposal: window.proposal,
      base: window.version,
      before: "Joined original content",
      after: "Joined resulting content",
    };
    window.render();
  });
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("");
  await expect(
    page.getByLabel("Deklarierter Autor (unverifizierte Anzeige)"),
  ).toHaveValue("");
  await expect(page.getByLabel("Säule 1", { exact: true })).toHaveValue("");
  await page
    .getByLabel("Entscheidungsgrund")
    .fill("Review complete stored proposal");
  await page
    .getByRole("combobox", { name: /Gespeicherter Korrekturvorschlag/ })
    .selectOption("saved-independent-proposal");
  const reviewTexts = [
    "Säulen (Gewichte): ORIGINAL REVIEW PILLAR (100 %)",
    "Verbotene Formulierungen: ORIGINAL REVIEW FORBIDDEN",
    "Vorheriger Ton: Original stored tone",
    "Vorgeschlagener Ton: PROPOSED REVIEW TONE",
    "Vorherige Positionierung: Original stored position",
    "Vorgeschlagene Positionierung: PROPOSED REVIEW POSITION",
    "Vorherige Säulen (Gewichte): ORIGINAL REVIEW PILLAR (100 %)",
    "Vorgeschlagene Säulen (Gewichte): PROPOSED REVIEW PILLAR (100 %)",
    "Vorherige Textbeispiele (keine Erfahrungsbehauptungen): ORIGINAL REVIEW EXAMPLE",
    "Vorgeschlagene Textbeispiele (keine Erfahrungsbehauptungen): PROPOSED REVIEW EXAMPLE",
    "Vorherige verbotene Formulierungen: ORIGINAL REVIEW FORBIDDEN",
    "Vorgeschlagene verbotene Formulierungen: PROPOSED REVIEW FORBIDDEN",
  ];
  for (const value of reviewTexts)
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Annehmen und neue Version erzeugen",
      exact: true,
    }),
  ).toBeEnabled();
  await page.screenshot({
    path: evidence + "/saved-proposal-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const value of reviewTexts)
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page
    .getByText(
      "Vorgeschlagene Säulen (Gewichte): PROPOSED REVIEW PILLAR (100 %)",
      { exact: true },
    )
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: evidence + "/saved-proposal-390.png" });
  await page
    .getByRole("button", {
      name: "Annehmen und neue Version erzeugen",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args.action)).toEqual(
    {
      kind: "accept",
      proposalId: "saved-independent-proposal",
      reason: "Review complete stored proposal",
    },
  );
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ revision: 11, versionId: "accepted-independent-version" }),
  );
  await expect(page.getByLabel("Gewünschter Ton")).toHaveValue("");
  await page.evaluate(() => {
    window.inspection.proposal = {
      ...window.proposal,
      sourceUnavailable: true,
      preferences: null,
    };
    window.inspection.base = {
      ...window.version,
      sourceUnavailable: true,
      payload: null,
    };
    window.inspection.before = null;
    window.inspection.after = null;
    window.render();
  });
  await expect(
    page.getByText(
      "Korrekturquelle nicht verfügbar. Kein Wiederherstellen geschützter Inhalte.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Annehmen und neue Version erzeugen",
      exact: true,
    }),
  ).toHaveCount(0);
  for (const value of reviewTexts.slice(2))
    await expect(page.getByText(value, { exact: true })).toHaveCount(0);
  // Empty stored preferences have explicit review labels rather than disappearing.
  await page.evaluate(() => {
    window.profile.versions = [];
    window.version = {
      ...window.version,
      payload: {
        ...window.version.payload,
        tone: "",
        positioning: "",
        examples: [],
        forbidden: [],
      },
    };
    window.proposal = {
      ...window.proposal,
      preferences: {
        ...window.proposal.preferences,
        tone: "",
        positioning: "",
        examples: [],
        forbidden: [],
      },
    };
    window.inspection = {
      proposal: window.proposal,
      base: window.version,
      before: "",
      after: "",
    };
    window.render();
  });
  for (const value of [
    "Vorheriger Ton: leer",
    "Vorgeschlagener Ton: leer",
    "Vorherige Positionierung: leer",
    "Vorgeschlagene Positionierung: leer",
    "Vorherige Textbeispiele (keine Erfahrungsbehauptungen): keine",
    "Vorgeschlagene Textbeispiele (keine Erfahrungsbehauptungen): keine",
    "Vorherige verbotene Formulierungen: keine",
    "Vorgeschlagene verbotene Formulierungen: keine",
  ])
    await expect(page.getByText(value, { exact: true })).toBeVisible();
  await page.goto("http://127.0.0.1:5178/style-fixture?demo=1");
  await expect(
    page.getByText("Building in public", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.queries.some((x) => x.name.startsWith("ai/styleProfiles")),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
  writeFileSync(
    evidence + "/browser.receipt.json",
    JSON.stringify(
      {
        status: "PASS",
        scope:
          "Version copy, explicit correction/accept/selection/history plus actual styled Settings production component, mocked Convex hooks; desktop/390/Demo, exact pending/error/retry/revision/dirty/account/role fences",
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS actual styled Settings desktop/390/Demo and explicit command fences; mocked transport only.",
  );
} finally {
  await browser?.close();
  await server.close();
}
