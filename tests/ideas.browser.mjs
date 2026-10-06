import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='content/ideas:list')return window.list;if(name==='content/ideas:get')return window.linked??null;if(name==='content/performance:context')return {entries:[],configuration:null};if(name==='ai/runs:availability')return {processingApproved:false,pricingApproved:false};if(name==='content/ideas:generationStatus')return window.runs;return {page:[],isDone:true,continueCursor:''};};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));`,
  "@/lib/auth-client": `export const demoMode=false;`,
  "@/lib/store": `import {useState} from "react"; export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>({state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,accounts:[{id:'account-one',workspaceId:window.workspace,name:'Synthetic',channel:'X'}]}});`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {IdeasPage} from '/src/pages/Ideas.tsx';import {SignalIdeaHandoff} from '/src/features/ideas/signal-handoff.tsx';function Route(){return React.createElement('p',{'data-testid':'route','data-account':window.account},useLocation().pathname);}window.workspace='workspace-one';window.account='';window.role='Owner';window.queries=[];window.commands=[];window.list=undefined;window.runs=[];window.allowed=true;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{key:window.workspace,initialEntries:[new URLSearchParams(location.search).has('idea')?'/ideas'+location.search:'/']},React.createElement(Route),new URLSearchParams(location.search).has('signal')?React.createElement(SignalIdeaHandoff,{key:window.workspace,workspaceId:window.workspace,signalId:'actual-signal',title:'Actual signed event',allowed:window.allowed}):React.createElement(IdeasPage))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/idea-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "idea-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0idea-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/idea-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__idea-entry"></script>',
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
  await page.goto("http://127.0.0.1:5174/idea-fixture");
  await expect(page.getByText("Ideen werden geladen …")).toBeVisible();
  await page.evaluate(() => {
    window.list = { page: [], isDone: true, continueCursor: "" };
    window.render();
  });
  await expect(page.getByText("Noch Raum für neue Gedanken")).toBeVisible();
  await page.getByRole("button", { name: "Idee festhalten" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titel", { exact: true }).fill("Buffered idea");
  await dialog.getByLabel("Eigene Angaben (ungeprüft)").fill("User context");
  await dialog
    .getByLabel("Perspektive", { exact: true })
    .fill("Human perspective");
  await dialog.getByRole("button", { name: "Idee speichern" }).click();
  await expect(
    dialog.getByRole("button", { name: "Wird gespeichert …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands.length)).toBe(1);
  const first = await page.evaluate(() => window.commands[0].args);
  expect(first.workspaceId).toBe("workspace-one");
  expect(first.source).toEqual({ kind: "note" });
  await page.evaluate(() =>
    window.commands[0].reject(new Error("synthetic denied")),
  );
  await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue(
    "Buffered idea",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Perspektive", exact: true }),
  ).toHaveValue("Human perspective");
  await dialog.getByRole("button", { name: "Idee speichern" }).click();
  expect(await page.evaluate(() => window.commands[1].args.operationKey)).toBe(
    first.operationKey,
  );
  await page.evaluate(() => {
    window.list = {
      page: [
        {
          idea: {
            _id: "actual-idea",
            workspaceId: window.workspace,
            revision: 1,
            status: "new",
            currentVersionId: "actual-idea-version",
          },
          version: {
            _id: "actual-idea-version",
            title: "Buffered idea",
            note: "User context",
            perspective: "Human perspective",
            priority: "normal",
            number: 1,
            source: { kind: "note" },
            originals: [],
            questions: [],
            rationale: "",
          },
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.commands[1].resolve("actual-idea");
    window.render();
  });
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Nutzerangabe · ungeprüft: User context"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await dialog.getByLabel("Titel", { exact: true }).fill("Edited buffer");
  await dialog
    .getByLabel("Änderungsfeedback")
    .fill("Corrected an unsupported claim");
  await dialog.getByRole("button", { name: "Idee speichern" }).click();
  await page.evaluate(() =>
    window.commands[2].reject(new Error("IDEA_REVISION_CONFLICT")),
  );
  await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue(
    "Edited buffer",
  );
  await expect(dialog.getByRole("alert")).toContainText("inzwischen geändert");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Zum Entwurf", exact: true }).click();
  await dialog
    .getByLabel("Konkrete Absicht / geklärte Angaben")
    .fill("Editable draft only");
  await dialog
    .getByLabel(
      "Entwurfstext · Angaben und Interpretation vor Übernahme prüfen",
    )
    .fill("Explicit reviewed text");
  await dialog
    .getByRole("button", { name: "Text geprüft · Entwurf erstellen" })
    .click();
  await expect(page.getByTestId("route")).toHaveText("/");
  expect(await page.evaluate(() => window.commands[3].args)).toMatchObject({
    ideaId: "actual-idea",
    expectedRevision: 1,
    draftText: "Explicit reviewed text",
    accountId: null,
  });
  await page.evaluate(() =>
    window.commands[3].resolve({
      draftId: "actual-draft",
      versionId: "actual-draft-version",
      ideaVersionId: "actual-idea-version",
    }),
  );
  await expect(page.getByTestId("route")).toHaveText("/drafts/actual-draft");
  await page.getByRole("button", { name: "Perspektive vorschlagen" }).click();
  await dialog.getByLabel("Zielaccount").selectOption("account-one");
  await dialog
    .getByLabel("Konkrete Absicht / geklärte Angaben")
    .fill("Explore and clarify");
  await dialog.getByRole("button", { name: "Vorschlag anfordern" }).click();
  await page.evaluate(() =>
    window.commands[4].reject(
      new Error("MODEL_PROCESSING_CONFIGURATION_REQUIRED"),
    ),
  );
  await expect(
    dialog.getByLabel("Konkrete Absicht / geklärte Angaben"),
  ).toHaveValue("Explore and clarify");
  await expect(dialog.getByRole("alert")).toContainText("EU-Verarbeitungspfad");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Idee festhalten" }).click();
  await dialog
    .getByLabel("Titel", { exact: true })
    .fill("Old workspace buffer");
  await dialog.getByRole("button", { name: "Idee speichern" }).click();
  await page.evaluate(() => {
    window.workspace = "workspace-two";
    window.list = { page: [], isDone: true, continueCursor: "" };
    window.render();
  });
  await page.evaluate(() =>
    window.commands[5].reject(new Error("late old error")),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByTestId("route")).toHaveText("/");
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Idee festhalten" }),
  ).toBeDisabled();
  await page.goto("http://127.0.0.1:5174/idea-fixture");
  await page.evaluate(() => {
    window.list = {
      page: [
        {
          idea: {
            _id: "model-idea",
            workspaceId: window.workspace,
            revision: 1,
            status: "new",
          },
          version: {
            _id: "model-version",
            title: "Unproven accomplishment",
            note: "Original user claim",
            perspective: "I shipped a successful project",
            priority: "normal",
            number: 1,
            source: { kind: "note" },
            originals: [],
            questions: ["What was achieved?"],
            rationale: "Unverified interpretation",
            runId: "actual-run",
          },
        },
      ],
      isDone: true,
      continueCursor: "",
    };
    window.render();
  });
  await expect(
    page.getByText(
      "Modellinterpretation · Klärung erforderlich: I shipped a successful project",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zum Entwurf", exact: true }).click();
  await dialog
    .getByLabel("Konkrete Absicht / geklärte Angaben")
    .fill("Only verified statement, not unsupported success");
  await dialog
    .getByLabel(
      "Entwurfstext · Angaben und Interpretation vor Übernahme prüfen",
    )
    .fill("Human checked content");
  await expect(
    dialog.getByRole("button", { name: "Text geprüft · Entwurf erstellen" }),
  ).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Text geprüft · Entwurf erstellen" })
    .click();
  expect(
    await page.evaluate(() => window.commands[0].args.clarificationConfirmed),
  ).toBe(true);
  await page.evaluate(() => {
    window.account = "account-one";
    window.render();
  });
  await expect(page.getByTestId("route")).toHaveAttribute(
    "data-account",
    "account-one",
  );
  await page.evaluate(() =>
    window.commands[0].resolve({
      draftId: "historical-account-draft",
      versionId: "actual-version",
      ideaVersionId: "model-version",
    }),
  );
  await expect(
    dialog.getByLabel(
      "Entwurfstext · Angaben und Interpretation vor Übernahme prüfen",
    ),
  ).toHaveValue("Human checked content");
  await expect(page.getByTestId("route")).toHaveText("/");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    window.runs = [
      {
        runId: "actual-run",
        state: "running",
        resultIdeaId: null,
        styleVersionId: "pinned-style",
        sourceUntil: null,
        styleUnavailable: false,
        usagePending: true,
        errorCode: null,
      },
    ];
    window.render();
  });
  await page.getByRole("button", { name: "Perspektive vorschlagen" }).click();
  await expect(
    dialog.getByText("Gebundene Stilversion: pinned-style"),
  ).toBeVisible();
  await expect(
    dialog.getByText("Nutzung wird noch abgeglichen", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Generierung abbrechen" }).click();
  await expect(
    dialog.getByRole("button", { name: "Generierung abbrechen" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toEqual({
    workspaceId: "workspace-one",
    runId: "actual-run",
  });
  await page.evaluate(() =>
    window.commands.at(-1).reject(new Error("synthetic stop denied")),
  );
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button", { name: "Generierung abbrechen" }).click();
  await page.evaluate(() => {
    window.commands.at(-1).resolve(null);
    window.runs = [
      { runId: "actual-run", state: "stopped", resultIdeaId: null },
    ];
    window.render();
  });
  await expect(
    dialog.getByText("Lauf stopped · kein gespeichertes Ergebnis"),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:5174/idea-fixture?signal=1");
  await page
    .getByLabel("Eigene redaktionelle Perspektive")
    .fill("Signal perspective buffer");
  await page
    .getByRole("button", { name: "Als belegte Idee übernehmen" })
    .click();
  expect(await page.evaluate(() => window.commands[0].args.source)).toEqual({
    kind: "signal",
    signalId: "actual-signal",
  });
  await page.evaluate(() =>
    window.commands[0].reject(new Error("GITHUB_SOURCE_DISABLED")),
  );
  await expect(page.getByLabel("Eigene redaktionelle Perspektive")).toHaveValue(
    "Signal perspective buffer",
  );
  await page
    .getByRole("button", { name: "Als belegte Idee übernehmen" })
    .click();
  await page.evaluate(() => {
    window.allowed = false;
    window.render();
  });
  await expect(
    page.getByText(
      "Aktuelle Content-Freigabe, unveränderte Quellenversion und Editor-Rechte erforderlich.",
    ),
  ).toBeVisible();
  await page.evaluate(() =>
    window.commands[1].resolve("saved-before-withdrawal"),
  );
  await page.waitForTimeout(50);
  await expect(
    page.getByRole("link", { name: "Gespeicherte Idee öffnen" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Als belegte Idee übernehmen" }),
  ).toBeDisabled();
  await page.goto(
    "http://127.0.0.1:5174/idea-fixture?idea=actual-linked-old-idea",
  );
  await page.evaluate(() => {
    window.list = { page: [], isDone: true, continueCursor: "" };
    window.linked = {
      idea: {
        _id: "actual-linked-old-idea",
        workspaceId: window.workspace,
        revision: 1,
        status: "new",
        currentVersionId: "old-version",
      },
      version: {
        _id: "old-version",
        title: "Linked older actual idea",
        note: "Unverified human note",
        perspective: "Saved perspective",
        priority: "normal",
        number: 1,
        source: { kind: "note" },
        originals: [],
        questions: [],
        rationale: "",
      },
    };
    window.render();
  });
  await expect(
    page.getByText("Linked older actual idea", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.role = "Owner";
    window.linked = {
      ...window.linked,
      version: {
        ...window.linked.version,
        title: "Protected cached idea",
        note: "Protected copied note",
        source: { kind: "research", evidenceId: "evidence" },
        sourceProofUntil: Date.now() + 2000,
      },
    };
    window.render();
  });
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await dialog
    .getByLabel("Eigene Angaben (ungeprüft)")
    .fill("Protected edited buffer");
  await expect(dialog).toHaveCount(0, { timeout: 5000 });
  await expect(
    page.getByText("Protected cached idea", { exact: true }),
  ).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(
    "Protected edited buffer",
  );
  await page.goto("http://127.0.0.1:5174/idea-fixture?idea=style-error-idea");
  await page.evaluate(() => {
    window.list = { page: [], isDone: true, continueCursor: "" };
    window.linked = {
      idea: {
        _id: "style-error-idea",
        workspaceId: window.workspace,
        revision: 1,
        status: "new",
        currentVersionId: "style-error-input",
      },
      version: {
        _id: "style-error-input",
        title: "Style error input",
        note: "User note",
        perspective: "User perspective",
        priority: "normal",
        number: 1,
        source: { kind: "note" },
        originals: [],
        questions: [],
        rationale: "",
      },
    };
    window.render();
  });
  await page.getByRole("button", { name: "Perspektive vorschlagen" }).click();
  await dialog.getByLabel("Zielaccount").selectOption("account-one");
  await dialog
    .getByLabel("Konkrete Absicht / geklärte Angaben")
    .fill("Style error buffered intent");
  await dialog.getByRole("button", { name: "Vorschlag anfordern" }).click();
  await page.evaluate(() =>
    window.commands.at(-1).reject(new Error("STYLE_SELECTION_CHANGED")),
  );
  await expect(dialog.getByRole("alert")).toContainText(
    "gebundene Account-Stil",
  );
  await expect(
    dialog.getByLabel("Konkrete Absicht / geklärte Angaben"),
  ).toHaveValue("Style error buffered intent");
  await page.evaluate(() => {
    window.runs = [
      {
        runId: "old-style-run",
        state: "failed",
        resultIdeaId: null,
        styleVersionId: "old-style-pin",
        sourceUntil: null,
        styleUnavailable: true,
        usagePending: true,
        errorCode: "STYLE_SELECTION_CHANGED",
      },
    ];
    window.render();
  });
  await expect(
    dialog.getByText("Gebundene Stilversion: old-style-pin"),
  ).toBeVisible();
  await expect(
    dialog.getByText(
      "Der gebundene Stil oder seine Quelle ist nicht mehr verfügbar.",
      { exact: false },
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Actual real Ideas + signal handoff: loading/manual ack/idempotent key/pending/CAS buffer/draft-ID navigation/config failure/model clarification/account/stop/workspace/Viewer/withdrawal PASS; no provider call.",
  );
} finally {
  await browser?.close();
  await server.close();
}
