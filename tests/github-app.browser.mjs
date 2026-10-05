import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
 const callback=args=>new Promise((resolve,reject)=>window.pending.push({resolve,reject,args}));
 const status=async()=>({configured:window.configured,installationConfigured:false,redirectUri:'https://dispatch.example/integrations/github/callback'});
 const command=args=>new Promise((resolve,reject)=>window.commands.push({resolve,reject,args}));
 export const useAction=ref=>getFunctionName(ref).endsWith(':callback')?callback:getFunctionName(ref).endsWith(':status')?status:command;
 export const useMutation=()=>command; export const useQuery=()=>window.sources;`,
  "@/lib/auth-client": `export const demoMode=new URLSearchParams(location.search).get('demo')==='1';`,
  "@/lib/store": `import {useState} from 'react'; export const useStore=()=>({state:{activeWorkspaceId:window.workspace,role:window.role,accounts:[],ideas:[]},setState:()=>false}); export const useWorkspaceLocalState=(key,initial)=>useState(initial);`,
};
const entry = `import React from 'react'; import ReactDOM from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom';
import {GithubSources,GithubOAuthCallback} from '/src/features/settings/github.tsx';import {SignalsPage} from '/src/pages/Ideas.tsx';
window.pending=[];window.commands=[];window.workspace='workspace-one';window.role='Owner';window.configured=false;window.sources={connection:null,repositories:[]};
const root=ReactDOM.createRoot(document.getElementById('root'));
window.renderCallback=(workspace,key='callback')=>{window.workspace=workspace;root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement(GithubOAuthCallback,{key}))));};
window.renderSettings=(key=window.workspace)=>root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement(GithubSources,{key}))));
window.renderSignals=()=>root.render(React.createElement(MemoryRouter,null,React.createElement(SignalsPage)));
window.unmount=()=>root.render(null);if(new URLSearchParams(location.search).has('signals'))window.renderSignals();else window.renderCallback(window.workspace);`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/github-app-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "github-app-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0github-app-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/github-app-fixture")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__github-app-entry"></script>',
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
  await page.addInitScript(() => {
    const add = document.addEventListener.bind(document),
      remove = document.removeEventListener.bind(document);
    window.proofVisibilityListeners = new Set();
    document.addEventListener = (name, listener, ...options) => {
      if (name === "visibilitychange")
        window.proofVisibilityListeners.add(listener);
      return add(name, listener, ...options);
    };
    document.removeEventListener = (name, listener, ...options) => {
      if (name === "visibilitychange")
        window.proofVisibilityListeners.delete(listener);
      return remove(name, listener, ...options);
    };
  });
  await page.clock.install({ time: new Date() });
  await page.goto(
    "http://127.0.0.1:5174/github-app-fixture?state=synthetic-state&code=synthetic-code&installation_id=999",
  );
  await page.waitForFunction(() => window.pending.length === 1);
  expect(await page.evaluate(() => location.search)).toBe("");
  expect(await page.evaluate(() => window.pending[0].args)).not.toHaveProperty(
    "installation_id",
  );
  await page.evaluate(() => window.pending[0].resolve(null));
  await expect(page.getByRole("status")).toContainText(
    "GitHub-App-Zugang geprüft",
  );
  expect(await page.evaluate(() => window.pending.length)).toBe(1);
  await page.evaluate(() => {
    history.replaceState(null, "", "?state=second&error=access_denied");
    window.renderCallback("workspace-one", "denied");
  });
  await page.waitForFunction(() => window.pending.length === 2);
  expect(await page.evaluate(() => window.pending[1].args.denied)).toBe(true);
  await page.evaluate(() =>
    window.pending[1].reject(new Error("GITHUB_OAUTH_DENIED")),
  );
  await expect(page.getByRole("alert")).toContainText("abgelehnt");
  await page.evaluate(() => {
    history.replaceState(null, "", "?state=third&code=third");
    window.renderCallback("workspace-one", "switch");
  });
  await page.waitForFunction(() => window.pending.length === 3);
  await page.evaluate(() => window.renderCallback("workspace-two", "switch"));
  await expect(page.getByRole("alert")).toContainText(
    "Workspace hat sich geändert",
  );
  await page.evaluate(() => window.pending[2].resolve(null));
  await expect(page.getByRole("alert")).toContainText(
    "Workspace hat sich geändert",
  );
  expect(await page.evaluate(() => window.pending.length)).toBe(3);
  await page.evaluate(() => {
    window.unmount();
    window.renderSettings();
  });
  await expect(
    page.getByRole("button", { name: "GitHub-App verbinden", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("GitHub-App-Quellen sind noch nicht konfiguriert.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    window.configured = true;
    window.sources = {
      connection: {
        status: "connected",
        login: "fixture",
        identity: "7",
        installations: [{ id: "50", owner: "fixture", kind: "User" }],
        inventoryLimited: false,
      },
      repositories: [
        {
          _id: "repo",
          providerId: "101",
          installationId: "50",
          fullName: "fixture/project",
          private: true,
          access: true,
          monitoring: false,
          content: false,
          communicableContext: "",
          generation: 1,
          verifiedAt: Date.now(),
          proofExpiresAt: Date.now() + 900000,
          authorized: true,
          purposeAt: Date.now(),
        },
      ],
    };
    window.renderSettings("connected");
  });
  await expect(
    page.getByText("GITHUB_APP_PRIVATE_KEY fehlt oder ist ungültig.", {
      exact: false,
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Ereignismetadaten überwachen" })
    .check();
  await page
    .getByRole("checkbox", { name: "Redaktionelle Content-Aufträge erlauben" })
    .check();
  await page
    .getByRole("textbox", {
      name: "Ausdrücklich kommunizierbarer Projektkontext",
    })
    .fill("Approved context");
  await page.getByRole("button", { name: "Einstellungen speichern" }).click();
  await page.waitForFunction(() => window.commands.length === 1);
  expect(await page.evaluate(() => window.commands[0].args.content)).toBe(true);
  await expect(
    page.getByRole("button", { name: "Einstellungen speichern" }),
  ).toBeDisabled();
  await page.evaluate(() =>
    window.commands[0].reject(new Error("GITHUB_SOURCE_CHANGED")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "zwischenzeitlich geändert",
  );
  await expect(
    page.getByRole("textbox", {
      name: "Ausdrücklich kommunizierbarer Projektkontext",
    }),
  ).toHaveValue("Approved context");
  await expect(
    page.getByText("Quellen-Einstellungen gespeichert.", { exact: true }),
  ).toHaveCount(0);
  // Cached Convex query data is intentionally unchanged: proof expiry must invalidate idle UI.
  await expect(
    page.getByText("Privat · Zugriff geprüft", { exact: true }),
  ).toHaveCount(1);
  await page.clock.fastForward(16 * 60000);
  await expect(
    page.getByText("Privat · Zugriff geprüft", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: "Ereignismetadaten überwachen" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("checkbox", {
      name: "Redaktionelle Content-Aufträge erlauben",
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Einstellungen speichern" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", {
      name: "Ausdrücklich kommunizierbarer Projektkontext",
    }),
  ).toHaveValue("Approved context");
  await page.evaluate(() => {
    window.sources = {
      ...window.sources,
      repositories: [
        {
          ...window.sources.repositories[0],
          proofExpiresAt: Date.now() + 900000,
          verifiedAt: Date.now(),
        },
      ],
    };
    window.renderSettings("connected");
  });
  await expect(
    page.getByText("Privat · Zugriff geprüft", { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Ereignismetadaten überwachen" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("textbox", {
      name: "Ausdrücklich kommunizierbarer Projektkontext",
    }),
  ).toHaveValue("Approved context");
  expect(await page.evaluate(() => window.proofVisibilityListeners.size)).toBe(
    1,
  );
  // Ordinary Signals must also hide the same cached row when its own deadline arrives.
  await page.evaluate(() => window.renderSignals());
  await expect(
    page.getByText("fixture/project · Privat · Monitoring aus · Content aus", {
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.fastForward(16 * 60000);
  await expect(
    page.getByText("fixture/project · Privat · Monitoring aus · Content aus", {
      exact: true,
    }),
  ).toHaveCount(0);
  await page.evaluate(() => window.renderSettings("expired-after-signals"));
  await page.getByRole("button", { name: "GitHub-App trennen" }).click();
  await page.waitForFunction(() => window.commands.length === 2);
  await page.evaluate(() => window.commands[1].resolve(null));
  await expect(page.getByRole("status")).toContainText("App lokal getrennt");
  await expect(page.getByRole("status")).toContainText(
    "Remote-Widerruf wurde nicht ausgeführt",
  );
  await page.evaluate(() => window.renderSignals());
  await expect(
    page.getByText("GitHub-Signale werden noch nicht eingelesen", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Kalenderansicht aufgeräumt", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Als Idee übernehmen" }),
  ).toHaveCount(0);
  // Visibility restoration rechecks wall-clock expiry even when the native timeout was suspended.
  await page.evaluate(() => {
    window.sources = {
      ...window.sources,
      repositories: [
        {
          ...window.sources.repositories[0],
          proofExpiresAt: Date.now() + 900000,
          verifiedAt: Date.now(),
        },
      ],
    };
    window.renderSettings("visible-check");
  });
  await expect(
    page.getByText("Privat · Zugriff geprüft", { exact: true }),
  ).toHaveCount(1);
  await page.clock.setFixedTime(
    new Date(await page.evaluate(() => Date.now() + 16 * 60000)),
  );
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByText("Privat · Zugriff geprüft", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => window.unmount());
  await expect
    .poll(() => page.evaluate(() => window.proofVisibilityListeners.size))
    .toBe(0);
  const demo = await browser.newPage();
  await demo.goto("http://127.0.0.1:5174/github-app-fixture?signals=1&demo=1");
  await expect(
    demo.getByText("Kalenderansicht aufgeräumt", { exact: true }),
  ).toBeVisible();
  await expect(demo.getByText("91 · Relevanz", { exact: true })).toBeVisible();
  await demo.close();
  expect(errors).toEqual([]);
  console.log(
    "GitHub App browser: StrictMode callback, denied/wrong-workspace, config guidance, awaited settings failure/disconnect and real/demo Signals passed.",
  );
} finally {
  await browser?.close();
  await server.close();
}
