import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
const callback=args=>new Promise((resolve,reject)=>window.pending.push({resolve,reject,args}));
const status=async()=>({configured:window.configured,redirectUri:'https://dispatch.example/integrations/x/callback'});
const disconnect=args=>new Promise((resolve,reject)=>window.commands.push({resolve,reject,args}));
export const useAction=ref=>getFunctionName(ref).endsWith(':callback')?callback:getFunctionName(ref).endsWith(':status')?status:disconnect;
export const useMutation=()=>disconnect;`,
  "@/lib/store": `export const useStore=()=>({state:{activeWorkspaceId:window.workspace,role:window.role,accounts:window.accounts}});`,
};
const entry = `
import React from 'react'; import ReactDOM from 'react-dom/client'; import {MemoryRouter} from 'react-router-dom';
import {XOAuthCallback,SocialAccounts} from '/src/features/settings/social-accounts.tsx';
window.pending=[];window.commands=[];window.workspace='workspace-one';window.role='Owner';window.accounts=[];window.configured=false;
const root=ReactDOM.createRoot(document.getElementById('root'));
window.renderCallback=(workspace,key='callback')=>{window.workspace=workspace;root.render(React.createElement(React.StrictMode,null,React.createElement(MemoryRouter,null,React.createElement(XOAuthCallback,{key}))));};
window.renderAccounts=()=>root.render(React.createElement(React.StrictMode,null,React.createElement(SocialAccounts,{key:window.workspace})));
window.unmount=()=>root.render(null);window.renderCallback(window.workspace);
`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/x-oauth-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "x-oauth-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0x-oauth-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/x-oauth-fixture")) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__x-oauth-entry"></script>',
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
  await page.goto(
    "http://127.0.0.1:5174/x-oauth-fixture?state=synthetic-state&code=synthetic-code",
  );
  await page.waitForFunction(() => window.pending.length === 1);
  expect(await page.evaluate(() => window.location.search)).toBe("");
  expect(await page.evaluate(() => window.pending[0].args.code)).toBe(
    "synthetic-code",
  );
  await page.evaluate(() => window.pending[0].resolve("account"));
  await expect(page.getByRole("status")).toContainText("X-Identität verbunden");
  expect(await page.evaluate(() => window.pending.length)).toBe(1);
  // Denied OAuth stays denied and settles under StrictMode, without a second exchange.
  await page.evaluate(() => {
    window.history.replaceState(null, "", "?state=second&error=access_denied");
    window.renderCallback("workspace-one", "denied");
  });
  await page.waitForFunction(() => window.pending.length === 2);
  expect(await page.evaluate(() => window.pending[1].args.denied)).toBe(true);
  await page.evaluate(() =>
    window.pending[1].reject(new Error("X_OAUTH_DENIED")),
  );
  await expect(page.getByRole("alert")).toContainText("abgelehnt");
  // Workspace switch suppresses the old completion and doesn't exchange against the new selection.
  await page.evaluate(() => {
    window.history.replaceState(null, "", "?state=third&code=third");
    window.renderCallback("workspace-one", "switch");
  });
  await page.waitForFunction(() => window.pending.length === 3);
  await page.evaluate(() => window.renderCallback("workspace-two", "switch"));
  await expect(page.getByRole("alert")).toContainText(
    "Workspace hat sich geändert",
  );
  await page.evaluate(() => window.pending[2].resolve("stale"));
  await expect(page.getByRole("alert")).toContainText(
    "Workspace hat sich geändert",
  );
  expect(await page.evaluate(() => window.pending.length)).toBe(3);
  // True unmount: stale success never appears in replacement Settings.
  await page.evaluate(() => {
    window.history.replaceState(null, "", "?state=fourth&code=fourth");
    window.renderCallback("workspace-two", "unmount");
  });
  await page.waitForFunction(() => window.pending.length === 4);
  await page.evaluate(() => {
    window.unmount();
    window.renderAccounts();
    window.pending[3].resolve("stale");
  });
  await expect(
    page.getByRole("button", { name: "X-Account verbinden", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "X-Konfiguration fehlt oder ist ungültig. Verbinden ist deshalb gesperrt.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "X-Identität verbunden. Live-Publishing wurde noch nicht geprüft.",
      { exact: true },
    ),
  ).toHaveCount(0);
  // A disconnect awaits the actual command; rejection cannot show success.
  await page.evaluate(() => {
    window.accounts = [
      {
        id: "account",
        workspaceId: "workspace-three",
        channel: "X",
        connection: "connected",
        name: "Fixture",
        handle: "@fixture",
        xEvidence: {
          textScopeEligible: true,
          mediaScopeEligible: false,
          liveWrite: "unverified",
        },
      },
    ];
    window.workspace = "workspace-three";
    window.renderAccounts();
  });
  const remove = page.getByRole("button", { name: "Trennen", exact: true });
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(remove).toBeDisabled();
  await page.waitForFunction(() => window.commands.length === 1);
  await page.evaluate(() =>
    window.commands[0].reject(new Error("ROLE_ACCESS_DENIED")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Owner- oder Admin-Rechte",
  );
  await expect(
    page.getByText(
      "Lokal getrennt. Der X-Zugang wurde nicht remote widerrufen.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await remove.click();
  await page.waitForFunction(() => window.commands.length === 2);
  await page.evaluate(() => window.commands[1].resolve(null));
  await expect(
    page.getByText(
      "Lokal getrennt. Der X-Zugang wurde nicht remote widerrufen.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "Actual X callback StrictMode success/denial/workspace-switch/unmount and Settings pending/config/error checks pass.",
  );
} finally {
  await browser?.close();
  await server.close();
}
