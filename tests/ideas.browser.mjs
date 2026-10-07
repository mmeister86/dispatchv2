import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
const evidence =
  process.env.DISPATCH_ROUTING_EVIDENCE_DIR ??
  "/tmp/dispatch-67.2-browser-ideas";
mkdirSync(evidence, { recursive: true });
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';import {ConvexError} from 'convex/values';
const read=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='content/ideas:list')return window.list;if(name==='content/ideas:get')return window.linked??null;if(name==='content/performance:context')return {entries:[],configuration:null};if(name==='ai/runs:availability')return {processingApproved:false,pricingApproved:false};if(name==='content/ideas:generationStatus')return window.runs;if(name==='ai/styleProfiles:get')return window.style??{control:null,versions:[],proposals:[],usable:false};if(name==='ai/styleProfiles:version')return window.styleVersion??null;if(name==='ai/jev/routing:get')return window.routingViews[args.operationId];return {page:[],isDone:true,continueCursor:''};};export const useQuery=read;export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore(){}});export const useConvex=()=>({query:async(ref,args)=>read(ref,args)});
export const useAction=ref=>async args=>{window.routingActions.push({name:getFunctionName(ref),args});if(window.classifyDeferred)return new Promise((resolve,reject)=>window.classifyCommands.push({args,resolve,reject}));window.routingViews[args.operationId]={...window.routingViews[args.operationId],result:{status:'routed',generatorKind:'generic',effectiveStrategy:'generic',category:'educational',suggestion:'educational',choiceConfidence:.75,score:75,noulProbability:null,thresholdVersion:'jev-routing-hypotheses-v1'},usage:{state:'settled',heldMicros:0,estimatedMicros:30,currency:'USD'}};};
export const useMutation=ref=>args=>{const name=getFunctionName(ref);if(name==='ai/jev/routing:prepare'){window.routingCommands.push({name,args});const prior=window.preparedIds[args.operationKey];const id=prior??'routing-'+window.routingCommands.length;window.preparedIds[args.operationKey]=id;if(!prior)window.routingViews[id]=window.nextRouting??{applicability:'current',sourceUntil:null,deadline:Date.now()+5000,usage:null,result:{status:args.intent.strategy?'human_choice':'configuration_required',generatorKind:'generic',effectiveStrategy:args.intent.strategy??'generic',category:null,suggestion:null,choiceConfidence:null,score:null,noulProbability:null,thresholdVersion:'jev-routing-hypotheses-v1'}};if(window.prepareDeferred)return new Promise((resolve,reject)=>window.prepareCommands.push({args,id,resolve,reject}));return Promise.resolve(id);}return new Promise((resolve,reject)=>window.commands.push({name,args,resolve,reject:error=>reject(error.message.startsWith('MODEL_')||error.message.startsWith('STYLE_')?new ConvexError(error.message):error)}));};`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const authClient={useSession:()=>({data:{session:{id:window.session},user:{id:'native-auth-user'}}})};`,
  "@/lib/store": `import {useState} from "react"; export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>({nativeScope:JSON.stringify(['native-auth-user',window.session,window.workspace,window.account,window.role]),state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,accounts:[{id:'account-one',workspaceId:window.workspace,name:'Synthetic',channel:'X'}],ideas:window.demoIdeas??[],drafts:[]},setState:fn=>{window.demoIdeas=fn({ideas:window.demoIdeas??[]}).ideas;window.render();}});`,
};
const entry = `import '/src/index.css';import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {IdeasPage} from '/src/pages/Ideas.tsx';import {SignalIdeaHandoff} from '/src/features/ideas/signal-handoff.tsx';function Route(){return React.createElement('p',{'data-testid':'route','data-account':window.account},useLocation().pathname);}window.session='session-one';window.routingViews={};window.preparedIds={};window.prepareCommands=[];window.routingCommands=[];window.routingActions=[];window.classifyCommands=[];window.workspace='workspace-one';window.account='';window.role='Owner';window.queries=[];window.commands=[];window.list=undefined;window.runs=[];window.allowed=true;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{key:window.workspace,initialEntries:[new URLSearchParams(location.search).has('idea')?'/ideas'+location.search:'/']},React.createElement(Route),new URLSearchParams(location.search).has('signal')?React.createElement(SignalIdeaHandoff,{key:window.workspace,workspaceId:window.workspace,signalId:'actual-signal',title:'Actual signed event',allowed:window.allowed}):React.createElement(IdeasPage))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${evidence}/vite-cache`,
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
              '<link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/@id/__x00__idea-entry"></script>',
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
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
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
  // Additional native routing consumer controls; every previous assertion above remains intact.
  async function freshRouting() {
    await page.goto("http://127.0.0.1:5174/idea-fixture");
    await page.evaluate(() => {
      window.account = "account-one";
      window.list = {
        page: [
          {
            idea: {
              _id: "routed-idea",
              workspaceId: window.workspace,
              revision: 1,
              status: "new",
              currentVersionId: "routed-input",
            },
            version: {
              _id: "routed-input",
              title: "Routing input",
              note: "Unverified human context",
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
      window.render();
    });
    await page.getByRole("button", { name: "Perspektive vorschlagen" }).click();
    await dialog
      .getByLabel("Konkrete Absicht / geklärte Angaben")
      .fill("Original complete intent");
    await expect(dialog.getByLabel("Ausdrückliche Strategie")).toHaveValue("");
  }
  async function picture(name, marker) {
    await expect(marker).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.allSettled(
        document
          .getAnimations()
          .filter(
            (a) =>
              Number.isFinite(a.effect?.getComputedTiming().iterations) &&
              a.playState === "running",
          )
          .map((a) => a.finished),
      );
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    });
    await expect(marker).toBeVisible();
    if (await dialog.count()) {
      await expect(dialog).toHaveCSS("opacity", "1");
      const bounds = await dialog.boundingBox();
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        await page.evaluate(() => innerHeight),
      );
      await dialog.evaluate((el) => {
        el.scrollTop = 0;
      });
      await expect(dialog.getByRole("heading")).toBeInViewport();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const path = `${evidence}/${name}.png`;
    if (existsSync(path))
      throw new Error("Screenshot evidence already exists: " + path);
    await page.screenshot({ path, fullPage: (await dialog.count()) === 0 });
    if (
      (await dialog.count()) &&
      (name.includes("held") || name.includes("original-unknown"))
    ) {
      await dialog.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      await expect(marker).toBeInViewport();
      await page.screenshot({
        path: `${evidence}/${name}-details.png`,
        fullPage: false,
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await freshRouting();
  expect(
    await dialog
      .getByLabel("Ausdrückliche Strategie")
      .locator("option")
      .count(),
  ).toBe(10);
  await dialog.getByLabel("Ausdrückliche Strategie").selectOption("generic");
  await dialog.getByLabel("Ziel (optional)").fill("Explain");
  await dialog.getByLabel("Ton (optional)").fill("Clear");
  await dialog
    .getByLabel("Handlungsaufforderung (optional)")
    .fill("Ask a question");
  await dialog.getByRole("button", { name: "Vorschlag anfordern" }).click();
  await expect(
    dialog.getByText("Ausdrückliche menschliche Auswahl", { exact: true }),
  ).toBeVisible();
  const prepared = await page.evaluate(() => window.routingCommands[0].args);
  expect(prepared).toMatchObject({
    ideaId: "routed-idea",
    expectedRevision: 1,
    accountId: "account-one",
    intent: {
      intent: "Original complete intent",
      strategy: "generic",
      objective: "Explain",
      tone: "Clear",
      cta: "Ask a question",
      outputKind: "perspective",
      network: "x",
    },
  });
  const generated = await page.evaluate(() => window.commands[0].args);
  expect(generated).toMatchObject({
    routingOperationId: "routing-1",
    operationKey: prepared.operationKey,
    intent: "Original complete intent",
  });
  expect(await page.evaluate(() => window.routingActions.length)).toBe(0);
  await page.evaluate(() =>
    window.commands[0].reject(new Error("ambiguous response")),
  );
  await expect(dialog.getByLabel("Ziel (optional)")).toBeDisabled();
  await expect(dialog.getByLabel("Zielaccount")).toBeDisabled();
  await picture(
    "ideas-original-unknown-1280",
    dialog.getByText("Ausdrückliche menschliche Auswahl", { exact: true }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await picture(
    "ideas-original-unknown-390",
    dialog.getByText("Ausdrückliche menschliche Auswahl", { exact: true }),
  );
  await dialog
    .getByRole("button", { name: "Denselben Auftrag wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands[1].args)).toEqual(generated);
  expect(await page.evaluate(() => window.routingCommands.length)).toBe(1);
  await page.evaluate(() => {
    window.commands[1].resolve("native-run");
    window.render();
  });
  await expect(
    page.getByText("Lauf gespeichert.", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.routingActions.length)).toBe(0);
  // A completed result outlives only its physical classification deadline, with its cost still explicit.
  await page.evaluate(() => {
    window.routingViews["routing-1"] = {
      ...window.routingViews["routing-1"],
      deadline: Date.now() - 10000,
      usage: {
        state: "unknown",
        heldMicros: 17000,
        estimatedMicros: null,
        currency: "USD",
      },
      result: {
        ...window.routingViews["routing-1"].result,
        status: "fallback",
      },
    };
    window.render();
  });
  await expect(
    dialog.getByText("Generischer Fallback", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Klassifikationskosten unbekannt", { exact: false }),
  ).toContainText("0.017000 USD");
  await picture(
    "ideas-fallback-held-390",
    dialog.getByText("Generischer Fallback", { exact: true }),
  );
  await expect(
    dialog.getByRole("button", {
      name: "Aktuellen Stand prüfen · neue Anfrage",
    }),
  ).toBeDisabled();
  // Lost funded classification must never be inferred from null result alone or dispatched again.
  await freshRouting();
  await page.evaluate(() => {
    window.nextRouting = {
      applicability: "current",
      sourceUntil: null,
      deadline: Date.now() + 5000,
      result: null,
      usage: {
        state: "unknown",
        heldMicros: 17000,
        estimatedMicros: null,
        currency: "USD",
      },
    };
  });
  await dialog.getByRole("button", { name: "Vorschlag anfordern" }).click();
  await expect(
    dialog.getByText("Kein abgeschlossenes Routing-Ergebnis", { exact: false }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Klassifikationskosten unbekannt", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.commands.length)).toBe(0);
  expect(await page.evaluate(() => window.routingActions.length)).toBe(0);
  await expect(
    dialog.getByRole("button", { name: "Denselben Auftrag wiederholen" }),
  ).toBeDisabled();
  await picture(
    "ideas-pending-held-390",
    dialog.getByText("Kein abgeschlossenes Routing-Ergebnis", { exact: false }),
  );
  // Lost prepare ACK retains the whole original command before an operation ID is known locally.
  await freshRouting();
  await dialog.getByLabel("Ausdrückliche Strategie").selectOption("generic");
  await dialog.getByLabel("Ziel (optional)").fill("Original prepare objective");
  await page.evaluate(() => {
    window.prepareDeferred = true;
  });
  await dialog.getByRole("button", { name: "Vorschlag anfordern" }).click();
  await expect
    .poll(() => page.evaluate(() => window.prepareCommands.length))
    .toBe(1);
  const lostPrepare = await page.evaluate(() => window.prepareCommands[0].args);
  await page.evaluate(() =>
    window.prepareCommands[0].reject(new Error("prepare response lost")),
  );
  await expect(
    dialog.getByRole("button", { name: "Denselben Auftrag wiederholen" }),
  ).toBeEnabled();
  await dialog
    .getByRole("button", { name: "Denselben Auftrag wiederholen" })
    .click();
  expect(await page.evaluate(() => window.prepareCommands[1].args)).toEqual(
    lostPrepare,
  );
  expect(
    await page.evaluate(() => Object.keys(window.preparedIds).length),
  ).toBe(1);
  await page.evaluate(() =>
    window.prepareCommands[1].resolve(window.prepareCommands[1].id),
  );
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(1);
  expect(await page.evaluate(() => window.commands[0].args)).toMatchObject({
    operationKey: lostPrepare.operationKey,
    routingOperationId: "routing-1",
    intent: lostPrepare.intent.intent,
  });
  expect(await page.evaluate(() => window.routingActions.length)).toBe(0);
  await page.evaluate(() =>
    window.commands[0].reject(new Error("generation response lost")),
  );
  // Actual purpose loss masks result but preserves its financial receipt; explicit Dismiss has no domain effect.
  await page.evaluate(() => {
    window.routingViews["routing-1"] = {
      applicability: "unavailable",
      sourceUntil: null,
      deadline: Date.now() + 5000,
      result: null,
      usage: {
        state: "unknown",
        heldMicros: 17000,
        estimatedMicros: null,
        currency: "USD",
      },
    };
    window.render();
  });
  await expect(
    dialog.getByText("Intent-Routing nicht mehr verfügbar"),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Denselben Auftrag wiederholen" }),
  ).toBeDisabled();
  const dismissBefore = await page.evaluate(() => ({
    commands: window.commands.length,
    prepare: window.routingCommands.length,
    actions: window.routingActions.length,
    usage: window.routingViews["routing-1"].usage,
  }));
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCount(0);
  expect(
    await page.evaluate(() => ({
      commands: window.commands.length,
      prepare: window.routingCommands.length,
      actions: window.routingActions.length,
      usage: window.routingViews["routing-1"].usage,
    })),
  ).toEqual(dismissBefore);
  // Pending unfinanced operation first-dispatches once; session ABA cannot admit the stale completion.
  await freshRouting();
  await page.evaluate(() => {
    window.nextRouting = {
      applicability: "current",
      sourceUntil: null,
      deadline: Date.now() + 5000,
      result: null,
      usage: null,
    };
    window.classifyDeferred = true;
  });
  await dialog.getByRole("button", { name: "Vorschlag anfordern" }).click();
  await expect
    .poll(() => page.evaluate(() => window.classifyCommands.length))
    .toBe(1);
  const originalClassification = await page.evaluate(
    () => window.classifyCommands[0].args,
  );
  expect(originalClassification).toEqual({
    workspaceId: "workspace-one",
    operationId: "routing-1",
  });
  await page.evaluate(() => {
    window.session = "session-two";
    window.render();
  });
  await expect(
    dialog.getByLabel("Konkrete Absicht / geklärte Angaben"),
  ).toBeEnabled();
  await page.evaluate(() => {
    window.session = "session-one";
    window.render();
  });
  await page.evaluate(() => {
    window.routingViews["routing-1"] = {
      ...window.routingViews["routing-1"],
      result: {
        status: "routed",
        generatorKind: "generic",
        effectiveStrategy: "educational",
        category: "educational",
        suggestion: null,
        choiceConfidence: 0.8,
        score: 80,
        noulProbability: null,
        thresholdVersion: "jev-routing-hypotheses-v1",
      },
    };
    window.classifyCommands[0].resolve(null);
    window.render();
  });
  await expect.poll(() => page.evaluate(() => window.commands.length)).toBe(0);
  await expect(
    page.getByText("Lauf gespeichert.", { exact: false }),
  ).toHaveCount(0);
  // Exact selected-style clock closes admission and clears protected intent without a query refresh.
  await freshRouting();
  await page.evaluate(() => {
    window.style = {
      control: {
        selectedVersionId: "selected-style",
        selectionReceiptId: "selected-receipt",
        selectedBy: "native-selector",
      },
      usable: true,
      versions: [],
      proposals: [],
    };
    window.styleVersion = { sourceUntil: Date.now() + 400 };
    window.render();
  });
  await expect(
    dialog.getByText("Account-Stil ausgewählt · nicht verfügbar", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Konkrete Absicht / geklärte Angaben"),
  ).toHaveValue("");
  await expect(
    dialog.getByRole("button", { name: "Vorschlag anfordern" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.routingCommands.length)).toBe(0);
  await picture(
    "ideas-style-expired-390",
    dialog.getByText("Account-Stil ausgewählt · nicht verfügbar", {
      exact: true,
    }),
  );
  // Current DTO history is separate from eligibility. Legacy generation history stays honestly unrouted.
  await freshRouting();
  await page.evaluate(() => {
    window.runs = [
      {
        runId: "historical-run",
        state: "failed",
        resultIdeaId: null,
        styleVersionId: null,
        sourceUntil: null,
        styleUnavailable: false,
        sourceUnavailable: false,
        usagePending: false,
        errorCode: null,
        routingOperationId: "historical-routing",
      },
    ];
    window.routingViews["historical-routing"] = {
      applicability: "historical",
      sourceUntil: null,
      deadline: Date.now() - 10000,
      usage: {
        state: "settled",
        heldMicros: 0,
        estimatedMicros: 30,
        currency: "USD",
      },
      result: {
        status: "human_choice",
        generatorKind: "generic",
        effectiveStrategy: "story",
        category: null,
        suggestion: null,
        choiceConfidence: null,
        score: null,
        noulProbability: null,
        thresholdVersion: "jev-routing-hypotheses-v1",
      },
    };
    window.render();
  });
  await expect(
    dialog.getByText("Historisches Intent-Routing · keine neue Freigabe"),
  ).toBeVisible();
  await picture(
    "ideas-history-390",
    dialog.getByText("Historisches Intent-Routing · keine neue Freigabe"),
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await picture(
    "ideas-history-1280",
    dialog.getByText("Historisches Intent-Routing · keine neue Freigabe"),
  );
  await page.goto("http://127.0.0.1:5174/idea-fixture?demo=1");
  await expect(
    page.getByRole("heading", { name: "Hier beginnt die Geschichte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Perspektive vorschlagen" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => window.routingCommands.length + window.routingActions.length,
    ),
  ).toBe(0);
  await picture(
    "ideas-demo-1280",
    page.getByRole("heading", { name: "Hier beginnt die Geschichte" }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await picture(
    "ideas-demo-390",
    page.getByRole("heading", { name: "Hier beginnt die Geschichte" }),
  );
  writeFileSync(
    `${evidence}/facts.json`,
    JSON.stringify(
      {
        productionCSS: true,
        viewports: [1280, 390],
        originalAssertions: true,
        routing:
          "generic/null/fallback/unknown/immutable/sessionABA/styleClock/history",
        Demo: "actual DemoIdeasPage with local state fixture; no native router",
        providerCalls: 0,
        consoleErrors: errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
  console.log(
    "Actual styled Ideas + signal handoff originals and native routing: explicit/null/generic, immutable whole-args retry, unknown holds/fallback/history, session ABA, clock-only style expiry, bounded 1280/390 dialog and actual Demo page PASS; synthetic transport, zero provider calls/console errors.",
  );
} finally {
  await browser?.close();
  await server.close();
}
