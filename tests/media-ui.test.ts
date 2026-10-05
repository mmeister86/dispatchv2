import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
const mocked = vi.hoisted(() => ({
  transfer: null as null | {
    open: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    abort: ReturnType<typeof vi.fn>;
    setRequestHeader: ReturnType<typeof vi.fn>;
    upload: {
      onprogress?: (e: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void;
    };
    onload?: () => void;
    onabort?: () => void;
    status: number;
  },
}));
vi.mock("../src/lib/auth-client", () => ({ demoMode: false }));
vi.mock("convex/react", () => ({
  useAction: () => vi.fn(),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted" }),
}));
vi.mock("../src/lib/store", () => ({
  useStore: () => ({
    state: { activeWorkspaceId: "workspace", role: "Owner", media: [] },
  }),
}));
import {
  MediaLibrary,
  mediaConfigurationGuidance,
} from "../src/features/drafts/media-library";
import { transferFile } from "../src/features/drafts/media-uploader";
test("real media UI exposes exact support/alt and unavailable studio without simulated success", () => {
  const html = renderToStaticMarkup(createElement(MediaLibrary));
  for (const text of [
    "Alt-Text",
    "32 MiB",
    "140 Sekunden",
    "ohne Interlacing",
    "noch nicht aktiviert",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("Demo-Untertitel");
  expect(html).not.toContain("Bild generieren");
});
test("missing configuration guidance names EU binding and keeps secret values out", () => {
  const guidance = mediaConfigurationGuidance;
  for (const name of [
    "R2_MEDIA_BUCKET",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "EU-Bucket",
    "Browser-CORS",
  ])
    expect(guidance).toContain(name);
});
test("direct upload reports actual progress, HTTP failure and abort", async () => {
  class XHR {
    status = 200;
    upload = {};
    onload?: () => void;
    onabort?: () => void;
    timeout = 0;
    open = vi.fn();
    setRequestHeader = vi.fn();
    send = vi.fn();
    abort = vi.fn(() => this.onabort?.());
    constructor() {
      mocked.transfer = this;
    }
  }
  vi.stubGlobal("XMLHttpRequest", XHR);
  try {
    const progress = vi.fn(),
      abort = new AbortController();
    const file = { type: "image/png" } as File;
    const done = transferFile(
      "https://signed.test/temp",
      file,
      progress,
      abort.signal,
    );
    const xhr = mocked.transfer!;
    xhr.upload.onprogress!({ lengthComputable: true, loaded: 1, total: 2 });
    expect(progress).toHaveBeenCalledWith(50);
    expect(xhr.send).toHaveBeenCalledWith(file);
    xhr.onload!();
    await done;
    const cancelled = transferFile(
      "https://signed.test/temp",
      file,
      progress,
      abort.signal,
    );
    abort.abort();
    await expect(cancelled).rejects.toThrow("MEDIA_UPLOAD_CANCELLED");
    const failed = transferFile(
      "https://signed.test/temp",
      file,
      progress,
      new AbortController().signal,
    );
    mocked.transfer!.status = 403;
    mocked.transfer!.onload!();
    await expect(failed).rejects.toThrow("MEDIA_TRANSFER_FAILED");
  } finally {
    vi.unstubAllGlobals();
  }
});
