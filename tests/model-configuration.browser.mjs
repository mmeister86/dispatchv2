import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { mkdtempSync, existsSync, mkdirSync } from "node:fs";
const artifactDir = mkdtempSync(join(tmpdir(), "dispatch-tests-"));
const evidence =
  process.env.DISPATCH_ROUTING_EVIDENCE_DIR ??
  `${artifactDir}/dispatch-67.2-browser-settings`;
mkdirSync(evidence, { recursive: true });
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';export const useQuery=(ref,args)=>{window.queries.push(args);if(args==='skip')return undefined;if(getFunctionName(ref)==='ai/jev/routing:availability')return window.routingAvailability??{status:'configuration_required'};if(getFunctionName(ref)==='ai/jev/access:availability')return window.jevAvailability;return getFunctionName(ref).endsWith(':recent')?window.runs:window.availability;};export const usePaginatedQuery=()=>({results:[],status:'Exhausted',loadMore(){}});export const useMutation=()=>args=>new Promise((resolve,reject)=>window.commands.push({args,resolve,reject}));`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';export const authClient={useSession:()=>({data:{session:{id:window.session},user:{id:'native-auth-user'}}})};`,
  "@/lib/store": `import {useState} from 'react'; export const useStore=()=>({nativeScope:JSON.stringify(['native-auth-user',window.session,window.workspace,window.account,window.role]),state:{activeWorkspaceId:window.workspace,activeAccountId:window.account,role:window.role,accounts:[{id:'account-one',workspaceId:window.workspace,name:'Synthetic',channel:'X'}],drafts:[]}});export const useWorkspaceLocalState=(key,initial)=>useState(initial);`,
};
const entry = `import '/src/index.css';import React from 'react';import ReactDOM from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import {ModelConfiguration} from '/src/features/settings/models.tsx';
window.session='session-one';window.role='Owner';window.account='account-one';window.workspace='workspace-one';window.queries=[];window.runs=[];window.commands=[];window.availability=undefined;window.jevAvailability=undefined;const root=ReactDOM.createRoot(document.getElementById('root'));window.render=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement(ModelConfiguration,{key:window.workspace}))));window.render();`;
const server = await createServer({
  root,
  configFile: `${root}/vite.config.ts`,
  cacheDir: `${evidence}/vite-cache`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "model-config-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0model-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/model-fixture")) return next();
          res.setHeader("content-type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/@id/__x00__model-entry"></script>',
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
  await page.goto("http://127.0.0.1:5174/model-fixture");
  await expect(
    page.getByText("Modellkonfiguration wird geladen …"),
  ).toBeVisible();
  await page.evaluate(() => {
    window.jevAvailability = {
      status: "disabled",
      guidance:
        "Jev-Bewertung benötigt eine vollständige EU-Verarbeitungsfreigabe. Manuelles Veröffentlichen bleibt unabhängig möglich.",
    };
    window.availability = {
      providerConfigured: true,
      processingApproved: false,
      pricingApproved: false,
      generation: "configuration_required",
      embedding: "disabled",
      semantic: "disabled",
    };
    window.render();
  });
  await expect(
    page.getByText(
      "Generation ist noch nicht freigegeben. Es wird kein Modell aufgerufen.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Provider-Zugang: hinterlegt.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Neue Unterhaltung" }),
  ).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.waitForTimeout(1100);
  await expect(
    page.getByText("Ich sehe einen guten Ansatz:", { exact: false }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.runs = [
      {
        runId: "run-one",
        purpose: "draft",
        state: "running",
        createdAt: Date.now(),
        attempts: 1,
        estimatedMicros: null,
        currency: "USD",
        usagePending: true,
      },
    ];
    window.render();
  });
  await expect(
    page.getByText("Kosten noch nicht verfügbar", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lauf abbrechen" }).click();
  await expect(
    page.getByRole("button", { name: "Abbruch wird gespeichert …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands[0].args)).toEqual({
    workspaceId: "workspace-one",
    runId: "run-one",
  });
  await page.evaluate(() =>
    window.commands[0].reject(new Error("synthetic denied")),
  );
  await expect(page.getByRole("alert")).toHaveText(
    "Abbruch konnte nicht gespeichert werden. Erneut versuchen.",
  );
  await page.getByRole("button", { name: "Lauf abbrechen" }).click();
  await page.evaluate(() => {
    window.workspace = "workspace-two";
    window.runs = [];
    window.availability = {
      providerConfigured: false,
      processingApproved: false,
      pricingApproved: false,
    };
    window.render();
  });
  await expect(
    page.getByText("Provider-Zugang: REQUESTY_API_KEY fehlt."),
  ).toBeVisible();
  await page.evaluate(() =>
    window.commands[1].reject(new Error("late first-workspace error")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.queries.at(-1).workspaceId)).toBe(
    "workspace-two",
  );
  await expect(page.getByText("Jev-Bewertung ist deaktiviert.")).toBeVisible();
  await page.evaluate(() => {
    window.jevAvailability = {
      status: "configuration_required",
      guidance:
        "Jev-Bewertung benötigt freigegebene Analysefragen und aktuelle geprüfte Profile.",
    };
    window.render();
  });
  await expect(
    page.getByText("Jev-Bewertung benötigt Konfiguration."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Jev-Bewertung deaktivieren" })
    .click();
  await expect(
    page.getByRole("button", { name: "Wird deaktiviert …" }),
  ).toBeDisabled();
  expect(await page.evaluate(() => window.commands[2].args)).toEqual({
    workspaceId: "workspace-two",
    accountId: "account-one",
  });
  await page.evaluate(() =>
    window.commands[2].reject(new Error("synthetic disabled access")),
  );
  await expect(page.getByRole("alert")).toHaveText(
    "Analysezugang konnte nicht deaktiviert werden. Erneut versuchen.",
  );
  await page.screenshot({
    path: `${evidence}/settings-original.png`,
    fullPage: true,
  });
  // New routing controls bind exact original account/session scope; no configure/enable API is invented.
  await page.setViewportSize({ width: 1280, height: 900 });
  const withdraw = page.getByRole("button", {
    name: "Routing-Zugang für Account entziehen",
  });
  await expect(withdraw).toBeVisible();
  await expect(
    page.getByText("Intent-Routing benötigt Konfiguration.", { exact: true }),
  ).toBeVisible();
  await withdraw.click();
  const originalRouting = await page.evaluate(() => window.commands[3].args);
  expect(originalRouting).toEqual({
    workspaceId: "workspace-two",
    accountId: "account-one",
  });
  await page.evaluate(() =>
    window.commands[3].reject(new Error("ambiguous routing withdrawal")),
  );
  await page
    .getByRole("button", { name: "Denselben Routing-Entzug wiederholen" })
    .click();
  expect(await page.evaluate(() => window.commands[4].args)).toEqual(
    originalRouting,
  );
  await page.evaluate(() => {
    window.session = "session-two";
    window.render();
  });
  await expect(
    page.getByRole("button", { name: "Denselben Routing-Entzug wiederholen" }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.session = "session-one";
    window.render();
  });
  await page.evaluate(() => window.commands[4].resolve(null));
  await expect(
    page.getByText("Routing-Zugang für diesen Account ausdrücklich entzogen."),
  ).toHaveCount(0);
  await page.evaluate(() => {
    window.routingAvailability = { status: "ready" };
    window.render();
  });
  await expect(
    page.getByText("Intent-Routing ist konfiguriert.", { exact: false }),
  ).toBeVisible();
  async function picture(name) {
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
    await expect(
      page.getByText("Intent-Routing ist konfiguriert.", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const path = `${evidence}/${name}.png`;
    if (existsSync(path)) throw new Error("Screenshot exists: " + path);
    await page.screenshot({ path, fullPage: true });
  }
  await picture("settings-routing-1280");
  await page.setViewportSize({ width: 390, height: 844 });
  await picture("settings-routing-390");
  await page.evaluate(() => {
    window.role = "Editor";
    window.render();
  });
  await expect(withdraw).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Routing.*(aktivieren|einrichten)/ }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  console.log(
    "Actual styled Settings original generation/Jev plus routing ready/configuration_required, exact withdrawal retry, session ABA/stale ACK and Editor restriction PASS at 1280/390; zero provider calls/console errors.",
  );
} finally {
  await browser?.close();
  await server.close();
}
