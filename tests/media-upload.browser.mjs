import { createServer } from "vite";
import { chromium, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const mocks = {
  "convex/react": `import {getFunctionName} from '/node_modules/convex/dist/esm/server/index.js';
 const call=(kind,args)=>new Promise((resolve,reject)=>window.pending.push({kind,args,resolve,reject}));
 const prepare=a=>call('prepare',a),finish=a=>call('finish',a),preview=a=>call('preview',a),remove=a=>call('remove',a);
 export const useAction=ref=>({prepare,finish,preview}[getFunctionName(ref).split(':').at(-1)]);
 export const useMutation=()=>remove;`,
  "@/lib/auth-client": `export const demoMode=false;`,
};
const entry = `import React from 'react';import ReactDOM from 'react-dom/client';
import {MediaUploader} from '/src/features/drafts/media-uploader.tsx';
import {MediaPreview} from '/src/features/drafts/media-preview.tsx';
window.pending=[];window.transfers=[];
class XHR {upload={};status=200;open(){}setRequestHeader(){}send(){window.transfers.push(this)}abort(){this.onabort?.()}}
window.XMLHttpRequest=XHR;
const root=ReactDOM.createRoot(document.getElementById('root'));
window.renderUpload=w=>root.render(React.createElement(React.StrictMode,null,React.createElement(MediaUploader,{key:w,workspaceId:w,disabled:false})));
window.renderPreview=w=>root.render(React.createElement(React.StrictMode,null,React.createElement(MediaPreview,{asset:{id:'asset',workspaceId:w,name:'Synthetic',alt:'Exact alt',type:'image',size:70,status:'ready',origin:'R2',url:''}})));
window.unmount=()=>root.render(null);window.renderUpload('one');`;
const server = await createServer({
  root,
  cacheDir: root + "/.cache/media-upload-vite",
  configFile: root + "/vite.config.ts",
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
  plugins: [
    {
      name: "quality-async",
      enforce: "pre",
      resolveId(id) {
        if (id.startsWith(root + "/src/lib/auth-client"))
          return "\0mock:@/lib/auth-client";
        if (id in mocks) return "\0mock:" + id;
      },
      load(id) {
        if (id === "\0quality-entry") return entry;
        if (id.startsWith("\0mock:")) return mocks[id.slice(6)];
      },
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (req.url !== "/quality-async") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            await s.transformIndexHtml(
              req.url,
              '<div id="root"></div><script type="module" src="/@id/__x00__quality-entry"></script>',
            ),
          );
        });
      },
    },
  ],
});
let browser;
await server.listen();
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      (existsSync(
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      )
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:5174/quality-async");
  const input = page.locator("input[type=file]"),
    upload = page.getByRole("button", { name: "Datei hochladen", exact: true }),
    alt = page.locator("textarea");
  async function pending(kind, index) {
    await page.waitForFunction(
      ({ kind, index }) =>
        window.pending.filter((x) => x.kind === kind).length > index,
      { kind, index },
    );
  }
  await input.setInputFiles({
    name: "Synthetic.png",
    mimeType: "image/png",
    buffer: Buffer.from([1]),
  });
  await alt.fill("Synthetic alt");
  await expect(upload).toBeEnabled();
  await expect(input).toHaveValue(/Synthetic\.png$/);
  await upload.click();
  await pending("prepare", 0);
  await page.evaluate(() =>
    window.pending
      .find((x) => x.kind === "prepare")
      .resolve({
        assetId: "asset",
        sessionId: "session",
        uploadUrl: "https://signed.test/temporary",
      }),
  );
  await page.waitForFunction(() => window.transfers.length === 1);
  await page.evaluate(() => window.transfers[0].onload());
  await pending("finish", 0);
  await page.evaluate(() =>
    window.pending
      .find((x) => x.kind === "finish")
      .reject(new Error("MEDIA_STORAGE_RETRY_REQUIRED")),
  );
  await expect(upload).toBeEnabled();
  await expect(input).toHaveValue(/Synthetic\.png$/);
  await expect(alt).toHaveValue("Synthetic alt");
  // Accepted success clears the same native selection and matching buffer explicitly.
  await upload.click();
  await pending("prepare", 1);
  await page.evaluate(() =>
    window.pending
      .filter((x) => x.kind === "prepare")[1]
      .resolve({
        assetId: "asset2",
        sessionId: "session2",
        uploadUrl: "https://signed.test/temporary",
      }),
  );
  await page.waitForFunction(() => window.transfers.length === 2);
  await page.evaluate(() => window.transfers[1].onload());
  await pending("finish", 1);
  await page.evaluate(() =>
    window.pending.filter((x) => x.kind === "finish")[1].resolve("asset2"),
  );
  await expect(input).toHaveValue("");
  await expect(alt).toHaveValue("");
  expect(await input.evaluate((e) => e.files.length)).toBe(0);
  // A queued replacement buffer must survive an older accepted completion.
  await input.setInputFiles({
    name: "Old.png",
    mimeType: "image/png",
    buffer: Buffer.from([1]),
  });
  await alt.fill("Old alt");
  await upload.click();
  await pending("prepare", 2);
  await page.evaluate(() =>
    window.pending
      .filter((x) => x.kind === "prepare")[2]
      .resolve({
        assetId: "asset3",
        sessionId: "session3",
        uploadUrl: "https://signed.test/temporary",
      }),
  );
  await page.waitForFunction(() => window.transfers.length === 3);
  await page.evaluate(() => window.transfers[2].onload());
  await pending("finish", 2);
  await input.setInputFiles({
    name: "New.png",
    mimeType: "image/png",
    buffer: Buffer.from([2]),
  });
  await page.evaluate(() =>
    window.pending.filter((x) => x.kind === "finish")[2].resolve("asset3"),
  );
  await expect(upload).toBeEnabled();
  await expect(input).toHaveValue(/New\.png$/);
  await expect(alt).toHaveValue("Old alt");
  expect(errors).toEqual([]);
  console.log(
    "Actual uploader preserves visible filename/buffer through failure and clears only the accepted current buffer.",
  );
} finally {
  await browser?.close();
  await server.close();
}
