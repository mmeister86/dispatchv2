import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
// Exercise the real component/effects in a browser, with provider effects deferred locally.
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
const status=async()=>({configured:false}); const noop=async()=>{};
const remove=args=>new Promise((resolve,reject)=>window.pending.push({resolve,reject,workspaceId:args.workspaceId}));
export const useAction=ref=>getFunctionName(ref).endsWith(':status')?status:noop;
export const useMutation=ref=>getFunctionName(ref).endsWith(':remove')?remove:noop;
export const usePaginatedQuery=()=>({results:[{_id:'asset',workspaceId:window.workspace,name:'Synthetic.png',type:'image',defaultAlt:'Synthetic',size:70,state:'uploading',uploadSessionId:'session'}],status:'Exhausted'});`,
  "@/lib/store": `export const useStore=()=>({state:{activeWorkspaceId:window.workspace,role:'Owner',media:[]}});`,
  "@/lib/auth-client": `export const demoMode=false;`,
  sonner: `export const toast={success:text=>window.notifications.push(text),error:text=>window.notifications.push(text)};`,
};
const entry = `
import React from 'react';
import ReactDOM from 'react-dom/client';
import {MediaLibrary} from '/src/features/drafts/media-library.tsx';
window.pending=[]; window.notifications=[]; window.workspace='workspace-one';
const root=ReactDOM.createRoot(document.getElementById('root'));
window.renderMedia=(workspace)=>{window.workspace=workspace;root.render(React.createElement(React.StrictMode,null,React.createElement(MediaLibrary,{key:workspace})));};
window.unmountMedia=()=>root.render(null);
window.renderMedia(window.workspace);
`;
const fixture = `<div id="root"></div><script type="module" src="/@id/__x00__media-lifecycle-entry"></script>`;
const server = await createServer({
  root,
  cacheDir: `${root}/.cache/media-lifecycle-vite`,
  configFile: `${root}/vite.config.ts`,
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "media-lifecycle-fixture",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(`${root}/src/lib/store`))
          return "\0fixture:@/lib/store";
        if (id.startsWith(`${root}/src/lib/auth-client`))
          return "\0fixture:@/lib/auth-client";
        if (id in mocks) return `\0fixture:${id}`;
      },
      load(id) {
        if (id === "\0media-lifecycle-entry") return entry;
        if (id.startsWith("\0fixture:")) return mocks[id.slice(9)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url !== "/media-lifecycle-fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(await s.transformIndexHtml(req.url, fixture));
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
  await page.goto("http://127.0.0.1:5174/media-lifecycle-fixture");
  const remove = page.getByRole("button", { name: "Löschen", exact: true });
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(remove).toBeDisabled();
  await page.waitForFunction(() => window.pending.length === 1);
  await page.evaluate(() => window.pending[0].resolve(null));
  await expect(remove).toBeEnabled();
  expect(await page.evaluate(() => window.notifications)).toHaveLength(1);
  await remove.click();
  await page.waitForFunction(() => window.pending.length === 2);
  await page.evaluate(() =>
    window.pending[1].reject(new Error("MEDIA_REFERENCED")),
  );
  await expect(remove).toBeEnabled();
  await expect(page.getByRole("alert")).toContainText(
    "unveränderlichen Inhaltsversion",
  );
  // True unmount: late success must not notify or mutate the replacement component.
  await remove.click();
  await page.waitForFunction(() => window.pending.length === 3);
  await page.evaluate(() => window.unmountMedia());
  await expect(remove).toHaveCount(0);
  await page.evaluate(() => {
    window.pending[2].resolve(null);
    window.renderMedia("workspace-two");
  });
  await expect(remove).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.notifications)).toHaveLength(1);
  // The app keys MediaLibrary by workspace. A rejected old command stays in that instance.
  await remove.click();
  await page.waitForFunction(() => window.pending.length === 4);
  await page.evaluate(() => window.renderMedia("workspace-three"));
  await expect(remove).toBeEnabled();
  await page.evaluate(() =>
    window.pending[3].reject(new Error("MEDIA_REFERENCED")),
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => window.notifications)).toHaveLength(1);
  expect(errors).toEqual([]);
  console.log(
    "Actual StrictMode MediaLibrary success, failure, unmount and workspace guards pass.",
  );
} finally {
  await browser?.close();
  await server.close();
}
