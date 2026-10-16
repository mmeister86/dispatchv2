import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useConvex=()=>({});export const useQuery=(ref,args)=>{if(args==='skip')return undefined;const name=getFunctionName(ref);window.queries.push({name,args});if(name==='intelligence/profiles:get')return window.profile;if(name==='intelligence/profiles:history')return window.historyRows;if(name==='intelligence/profileUpdates:list')return window.sourceRows;};export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useAction=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const authClient={useSession:()=>({data:window.session,isPending:false}),signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};`,
  "@/lib/store": `import {useState,useEffect} from 'react';export const useWorkspaceLocalState=(key,initial)=>useState(initial);export const useStore=()=>{const role=window.role;useEffect(()=>{window.committedRole=role;},[role]);return {state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role,accounts:[{id:window.account,workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[],ideas:[],schedules:[],preferences:{audience:'Personal preference'}},mutate:()=>{}};};`,
};
const entry = `import "/src/index.css";import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {OperationsPage} from '/src/pages/Operations.tsx';import {IntelligenceProfiles} from '/src/features/intelligence/profiles.tsx';window.workspace='workspace-one';window.account='account-one';window.role='Owner';window.queries=[];window.commands=[];window.profile=undefined;window.historyRows={page:[],isDone:true,continueCursor:''};window.sourceRows=[];window.view='operations';const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,window.view==='operations'?React.createElement(OperationsPage):React.createElement(IntelligenceProfiles,{readOnly:window.view==='readonly',audienceOnly:window.view==='audience'}))));window.render();`;
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
  await page.clock.install();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174/intelligence-fixture");
  await expect(
    page.getByText("Gespeicherte Nachweise", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Algorithmusprofile" }).click();
  await expect(
    page.getByText("Gespeicherte Nachweise", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Lokale Demo", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Systemzustand" }).click();
  await expect(
    page.getByText("Betriebsbelege werden geladen …", { exact: true }),
  ).toBeVisible();
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
  await page.getByLabel("Profil-Kandidat").selectOption("post-analysis");
  await page
    .getByRole("button", { name: "Post-Analyse als Kandidat anlegen" })
    .click();
  const candidateInput = await page.evaluate(() => window.commands.at(-1).args);
  expect(candidateInput.variant).toBe("post-analysis");
  expect(candidateInput.accountId).toBe("account-two");
  expect(candidateInput.expectedRevision).toBe(0);
  await expect(page.getByLabel("Profil-Kandidat")).toBeDisabled();
  await page.evaluate(() =>
    window.commands.at(-1).reject(new Error("lost acknowledgement")),
  );
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toEqual(
    candidateInput,
  );
  await page.evaluate(() =>
    window.commands
      .at(-1)
      .resolve({ revision: 1, algorithmId: "candidate-one", audienceId: null }),
  );
  await expect(
    page.getByText("Aktion bestätigt.", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.role = "Editor";
    window.render();
  });
  await expect(page.getByLabel("Profil-Kandidat")).toBeDisabled();
  await page.evaluate(() => {
    window.role = "Owner";
    window.render();
  });
  await expect(page.getByLabel("Profil-Kandidat")).toBeEnabled();
  await page.screenshot({
    path: "/tmp/task28.2-profile-candidate.png",
    fullPage: true,
  });
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
  await page.getByLabel("Profil-Kandidat").selectOption("public-context");
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
  await page
    .getByLabel("Basisprofil für Quellencheck")
    .selectOption("algorithm-one");
  const selectedBefore = await page.evaluate(() => ({
    ...window.profile.capture,
  }));
  await page
    .getByRole("button", { name: "Quelle jetzt prüfen", exact: true })
    .click();
  const sourceInput = await page.evaluate(() => window.commands.at(-1).args);
  expect(sourceInput).toMatchObject({
    baseProfileId: "algorithm-one",
    full: false,
  });
  await expect(page.getByLabel("Basisprofil für Quellencheck")).toBeDisabled();
  await page.evaluate(() =>
    window.commands.at(-1).reject(new Error("lost source acknowledgement")),
  );
  await page
    .getByRole("button", { name: "Ursprüngliche Anfrage wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).args)).toEqual(
    sourceInput,
  );
  const publicSha = "e62790c99484b51424c2eccc488ed4e7517e8778";
  const observation = {
    commit: publicSha,
    commitAt: Date.now() - 10000,
    observedAt: Date.now(),
    reviewDueAt: Date.now() + 7 * 86400000,
    compareUrl: `https://github.com/xai-org/x-algorithm/compare/${"b".repeat(40)}...${publicSha}`,
    complete: true,
    issues: [],
    evidence: Array.from({ length: 13 }, (_, i) => ({
      path: `evidence-${i}.rs`,
      url: `https://github.com/xai-org/x-algorithm/blob/${publicSha}/evidence-${i}.rs`,
      sha256: "c".repeat(64),
    })),
    changes: [
      {
        path: "README.md",
        status: "modified",
        url: `https://github.com/xai-org/x-algorithm/blob/${publicSha}/README.md`,
        patch: "bounded excerpt",
        patchState: "clipped",
      },
      {
        path: "other.rs",
        status: "modified",
        url: `https://github.com/xai-org/x-algorithm/blob/${publicSha}/other.rs`,
        patch: "",
        patchState: "missing",
      },
    ],
  };
  await page.evaluate((observation) => {
    const receipt = {
      _id: "check-one",
      expectedPaths: observation.evidence.map((e) => e.path),
      baseProfileId: "algorithm-one",
      baseCommit: "b".repeat(40),
      kind: "check",
      createdAt: Date.now(),
      state: "proposed",
      requests: 15,
      bytes: 12345,
      error: null,
      notBefore: Date.now() + 600000,
      deadline: Date.now() + 45000,
      observation,
    };
    window.sourceRows = [
      receipt,
      {
        _id: "proposal-one",
        kind: "proposal",
        baseProfileId: "algorithm-one",
        baseCommit: "b".repeat(40),
        observation,
      },
    ];
    window.commands.at(-1).resolve(receipt);
    window.render();
  }, observation);
  await expect(page.getByText(/Quellencheck · proposed/)).toBeVisible();
  expect(await page.evaluate(() => window.profile.capture)).toEqual(
    selectedBefore,
  );
  await expect(
    page.getByRole("button", { name: "Quelle jetzt prüfen", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Quellenvorschlag").selectOption("proposal-one");
  await page
    .getByText("Alle geänderten Pfade und begrenzte Ausschnitte", {
      exact: true,
    })
    .click();
  await expect(page.getByText(/Ausschnitt gekürzt/)).toBeVisible();
  await expect(page.getByText(/Ausschnitt fehlt/)).toBeVisible();
  await page
    .getByText("13 Quellenbelege und vorherige Prüfsummen", { exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "evidence-12.rs", exact: true }),
  ).toHaveAttribute("href", observation.evidence[12].url);
  await page
    .getByLabel("Variante der Referenzprüfung")
    .selectOption("post-analysis");
  await page
    .getByLabel("Menschliche Quelleninterpretation")
    .fill("Explicit human source interpretation");
  await page
    .getByLabel("Quellenbezogene Auswirkung auf Dispatch")
    .fill("Source context only; unchanged Dispatch rubric");
  await page
    .getByLabel("Begründung der vollständigen Quellenprüfung")
    .fill("Reviewed the full compare and all 13 evidence paths");
  await expect(
    page.getByRole("button", {
      name: "Quelleninterpretation und Referenzprüfung festhalten",
    }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", {
      name: "Quelleninterpretation und Referenzprüfung festhalten",
    })
    .click();
  const evalInput = await page.evaluate(() => window.commands.at(-1).args);
  expect(evalInput).toMatchObject({
    variant: "post-analysis",
    proposalId: "proposal-one",
    fullSourceReview: true,
  });
  await page.evaluate(() => {
    window.sourceRows.push({
      _id: "evaluation-one",
      kind: "evaluation",
      proposalId: "proposal-one",
      variant: "post-analysis",
      actorId: "source-evaluator",
      interpretation: "Explicit human source interpretation",
      impact: "Source context only; unchanged Dispatch rubric",
      rationale: "Reviewed the full compare and all 13 evidence paths",
      reference: {
        version: "source-compatibility-v1",
        passed: true,
        outcomes: [
          { case: "neutral-valid", outcome: "success", aggregate: 55 },
        ],
      },
    });
    window.commands.at(-1).resolve("evaluation-one");
    window.render();
  });
  await page
    .getByRole("button", { name: "Frisches Quellenprofil als Draft anlegen" })
    .click();
  const freshInput = await page.evaluate(() => window.commands.at(-1).args);
  expect(freshInput).toMatchObject({
    proposalId: "proposal-one",
    evaluationId: "evaluation-one",
    variant: "post-analysis",
    expectedRevision: 1,
  });
  await page.evaluate(() =>
    window.commands.at(-1).resolve({
      revision: 2,
      algorithmId: "fresh-source-draft",
      audienceId: null,
    }),
  );
  await page.screenshot({
    path: "/tmp/task44-sources-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 390)
    console.log(
      await page.evaluate(() =>
        Array.from(document.querySelectorAll("*"))
          .filter((e) => e.getBoundingClientRect().right > 390)
          .map((e) => ({
            tag: e.tagName,
            class: e.className,
            text: e.textContent.slice(0, 70),
            width: e.getBoundingClientRect().width,
            right: e.getBoundingClientRect().right,
          }))
          .slice(-20),
      ),
    );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await expect(
    page.getByLabel("Menschliche Quelleninterpretation"),
  ).toHaveValue("Explicit human source interpretation");
  await page.screenshot({
    path: "/tmp/task44-sources-390.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    window.role = "Viewer";
    window.render();
  });
  await expect(page.getByLabel("Basisprofil für Quellencheck")).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Frisches Quellenprofil als Draft anlegen",
    }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.role = "Owner";
    window.sourceRows = [
      {
        _id: "failed-check",
        kind: "check",
        expectedPaths: ["README.md", "phoenix/README.md"],
        baseProfileId: "algorithm-one",
        baseCommit: "b".repeat(40),
        createdAt: Date.now(),
        state: "failed",
        requests: 1,
        bytes: 12,
        error: "http_404",
        notBefore: Date.now() + 600000,
        deadline: Date.now() + 45000,
        observation: null,
      },
    ];
    window.render();
  });
  await expect(page.getByText(/Quellencheck · failed/)).toBeVisible();
  await expect(page.getByText(/http_404/)).toBeVisible();
  await expect(
    page.getByText(/1 HTTP-Versuche · 12 tatsächlich empfangene Bytes/),
  ).toBeVisible();
  await page.evaluate(() => {
    window.sourceRows = [
      {
        ...window.sourceRows[0],
        _id: "pending-check",
        state: "pending",
        requests: 0,
        bytes: 0,
        error: null,
        deadline: Date.now() + 45000,
      },
    ];
    window.render();
  });
  await expect(page.getByText(/Quellencheck · pending/)).toBeVisible();
  await expect(
    page.getByText(/Transportzahlen unbekannt.*nicht abschließend quittiert/),
  ).toBeVisible();
  await expect(
    page.getByText(/0 HTTP-Versuche|0 tatsächlich empfangene Bytes/),
  ).toHaveCount(0);
  await page.clock.runFor(60001);
  await page
    .getByRole("button", { name: "Abgelaufenen Versuch klären" })
    .click();
  expect(await page.evaluate(() => window.commands.at(-1).name)).toBe(
    "intelligence/profileUpdates:inspect",
  );
  expect(await page.evaluate(() => window.commands.at(-1).args.checkId)).toBe(
    "pending-check",
  );
  await page.evaluate(() => {
    const terminal = {
      ...window.sourceRows[0],
      state: "unknown",
      error: "deadline_elapsed",
    };
    window.sourceRows = [terminal];
    window.commands.at(-1).resolve(terminal);
    window.render();
  });
  await expect(page.getByText(/Quellencheck · unknown/)).toBeVisible();
  await expect(
    page.getByText(/Transportzahlen unbekannt.*nicht abschließend quittiert/),
  ).toBeVisible();
  await expect(
    page.getByText(/0 HTTP-Versuche|0 tatsächlich empfangene Bytes/),
  ).toHaveCount(0);
  await expect(page.getByText(/deadline_elapsed/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abgelaufenen Versuch klären" }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.profile.capture)).toEqual(
    selectedBefore,
  );
  await page.goto("http://127.0.0.1:5174/intelligence-fixture?demo=1");
  await expect(page.getByText("Lokale Demo", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Algorithmusprofile" }).click();
  await expect(page.getByText("Lokale Demo", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Gespeicherte Nachweise", { exact: true }),
  ).toHaveCount(0);
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
    "PASS: source observation exact retry/current revision invariance, explicit full-source human attestation/evaluation/draft, bounded evidence desktop/390px/failure/current role, acknowledged failure totals and unconfirmed pending/inspected-unknown counters; new explicit post-analysis candidate with exact retry/current Editor guard, actual Operations profile tab, declared audience/read-only controls, exact retry, role withdrawal/restoration and account late ACK guards; registered mock transport, no live backend or analyzer.",
  );
} finally {
  await browser?.close();
  await server.close();
}
