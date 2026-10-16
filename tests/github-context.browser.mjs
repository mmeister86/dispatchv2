import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>window.rows;export const useMutation=ref=>args=>new Promise((resolve,reject)=>window.commands.push({name:getFunctionName(ref),args,resolve,reject}));export const useConvex=()=>({});export const useAction=()=>()=>Promise.reject(new Error("No provider"));export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore:()=>{}});`,
  "@/lib/auth-client": `export const demoMode=false;export const authClient={useSession:()=>({data:window.session,isPending:false}),signOut:async()=>{},signIn:{email:async()=>({})},signUp:{email:async()=>({})},sendVerificationEmail:async()=>({})};`,
  "@/lib/store": `export const useStore=()=>({state:{}});`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter,useLocation} from 'react-router-dom';import {SignalContext} from '/src/features/signals/context.tsx';window.workspace='workspace-one';window.account='account-one';window.allowed=true;window.generation=2;window.rows=[];window.commands=[];const root=ReactDOM.createRoot(document.getElementById('root'));function Route(){return React.createElement('p',{'data-testid':'route'},useLocation().pathname);}function Scene(){const p={workspaceId:window.workspace,signalId:'actual-signal',generation:window.generation,allowed:window.allowed,accountId:window.account};React.useEffect(()=>{window.committed=p;});return React.createElement(React.Fragment,null,React.createElement(Route),React.createElement(SignalContext,{key:window.workspace,...p}));}window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,{key:window.workspace},React.createElement(Scene))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${root}/.cache/context-fixture-vite`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "context-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0context-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/context-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__context-entry"></script>',
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
  await page.goto("http://127.0.0.1:5174/context-fixture");
  await page.getByText("Begrenzte Patch-Anreicherung", { exact: true }).click();
  const input = page.getByRole("textbox", {
    name: "Geänderte Pfade, durch Komma getrennt",
  });
  await input.fill("src/example.ts");
  const request = page.getByRole("button", {
    name: "Ausgewählte Patches prüfen",
  });
  await request.click();
  await expect(request).toBeDisabled();
  await expect(input).toBeDisabled();
  expect(await page.evaluate(() => window.commands.length)).toBe(1);
  const key = await page.evaluate(() => window.commands[0].args.operationKey);
  await page.evaluate(() =>
    window.commands[0].reject(Error("GITHUB_APP_PRIVATE_KEY_REQUIRED")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "GITHUB_APP_PRIVATE_KEY fehlt",
  );
  await expect(input).toHaveValue("src/example.ts");
  await request.click();
  expect(await page.evaluate(() => window.commands[1].args.operationKey)).toBe(
    key,
  );
  await page.evaluate(() => {
    window.allowed = false;
    window.render();
  });
  await expect(
    page.getByText(
      "Aktuelle separate Patch-Lese-Freigabe, gültiger Repository-Nachweis und Editor-Rechte nötig.",
    ),
  ).toBeVisible();
  await page.evaluate(() => window.commands[1].resolve("actual-context"));
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(input).toHaveValue("src/example.ts");
  await page.evaluate(() => {
    window.allowed = true;
    window.generation = 3;
    window.render();
  });
  await expect(input).toHaveValue("src/example.ts");
  await request.click();
  expect(
    await page.evaluate(() => window.commands[2].args.expectedGeneration),
  ).toBe(3);
  await page.evaluate(() => {
    window.commands[2].resolve("actual-context");
    window.rows = [
      {
        _id: "actual-context",
        paths: ["src/example.ts"],
        state: "ready",
        hash: "actual-hash",
        canApprove: true,
        approvedHash: null,
        excerpts: [
          {
            path: "src/example.ts",
            previousPath: null,
            blobSha: "actual-blob",
            patch: "@@ -1 +1 @@\n-old\n+new",
          },
        ],
        runId: null,
        decision: "pending",
        evidence: [],
        references: [],
      },
    ];
    window.render();
  });
  const approve = page.getByRole("checkbox", {
    name: "Ich habe diese Auszüge geprüft und erlaube genau ihre Modellweitergabe.",
  });
  await expect(approve).not.toBeChecked();
  await approve.click();
  await expect(approve).toBeDisabled();
  await expect(approve).not.toBeChecked();
  expect(await page.evaluate(() => window.commands[3].args.expectedHash)).toBe(
    "actual-hash",
  );
  await page.evaluate(() => {
    window.commands[3].resolve(null);
    window.rows[0].approvedHash = "actual-hash";
    window.render();
  });
  await expect(approve).toBeChecked();
  const summary = page.getByRole("button", {
    name: "Belegte redaktionelle Einordnung anfordern",
  });
  await summary.click();
  await page.evaluate(() =>
    window.commands[4].reject(Error("MODEL_PROCESSING_CONFIGURATION_REQUIRED")),
  );
  await expect(page.getByRole("alert")).toContainText("EU-Verarbeitungspfad");
  await expect(input).toHaveValue("src/example.ts");
  await summary.click();
  await page.evaluate(() => {
    window.account = "account-two";
    window.render();
  });
  await page.waitForFunction(
    () => window.committed.accountId === "account-two",
  );
  await page.evaluate(() => window.commands[5].resolve("actual-run"));
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.evaluate(() => {
    window.rows[0].runId = "actual-run";
    window.rows[0].runState = "running";
    window.render();
  });
  await page.getByRole("button", { name: "Anreicherung stoppen" }).click();
  await page.evaluate(() =>
    window.commands[6].reject(Error("synthetic denied")),
  );
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Anreicherung stoppen" }).click();
  await page.evaluate(() => {
    window.commands[7].resolve(null);
    window.rows[0].runState = "stopped";
    window.render();
  });
  await expect(page.getByText(/Modellauftrag: stopped/)).toBeVisible();
  await page.evaluate(() => {
    Object.assign(window.rows[0], {
      runState: "completed",
      decision: "maintenance",
      summary: "Selected maintenance",
      rationale: "Small selected change",
      novelty: "Unknown",
      uncertainty: "Uncalibrated",
      references: ["src/example.ts"],
      evidence: [{ path: "src/example.ts", quote: "+new" }],
      resultIdeaId: null,
    });
    window.render();
  });
  await expect(
    page.getByText("Keine Idee und kein Draft angelegt.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unkalibrierte Unsicherheit: Uncalibrated", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.rows[0].decision = "relevant";
    window.rows[0].resultIdeaId = "actual-idea";
    window.render();
  });
  await page
    .getByRole("link", { name: "Gespeicherte begründete Idee öffnen" })
    .click();
  await expect(page.getByTestId("route")).toHaveText("/ideas");
  await page.evaluate(() => {
    window.allowed = false;
    window.render();
  });
  await expect(input).toBeDisabled();
  await page.evaluate(() => {
    window.workspace = "workspace-two";
    window.rows = [];
    window.allowed = true;
    window.render();
  });
  await page.getByText("Begrenzte Patch-Anreicherung", { exact: true }).click();
  await expect(input).toHaveValue("");
  await input.fill("README.md");
  await request.click();
  await page.evaluate(() => {
    window.workspace = "workspace-three";
    window.render();
    window.commands[8].resolve("late-context");
  });
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "Actual SignalContext browser PASS: pending/stable retry/error buffers, current-generation and late permission/account/workspace, exact hash approval, truthful missing config, stop receipt, maintenance/no draft and actual idea navigation.",
  );
} finally {
  await browser?.close();
  await server.close();
}
