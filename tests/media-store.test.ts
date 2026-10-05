import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { mediaFixture } from "./media-fixture";
import { api } from "../convex/_generated/api";
const responses = vi.hoisted(() => ({
  queries: {} as Record<string, unknown>,
  pages: {} as Record<string, unknown[]>,
  calls: [] as { name: string; args: unknown }[],
  loadMore: vi.fn(),
}));
vi.mock("../src/lib/auth-client", () => ({ demoMode: false }));
vi.mock("convex/react", async () => {
  const { getFunctionName: name } = await import("convex/server");
  return {
    useQuery: (ref: Parameters<typeof name>[0]) => responses.queries[name(ref)],
    useMutation: (ref: Parameters<typeof name>[0]) => async (args: unknown) => {
      responses.calls.push({ name: name(ref), args });
    },
    usePaginatedQuery: (ref: Parameters<typeof name>[0]) => ({
      results: responses.pages[name(ref)] ?? [],
      status: "CanLoadMore",
      loadMore: responses.loadMore,
    }),
  };
});
import { WorkspaceStoreProvider, useStore } from "../src/lib/store";
let store: ReturnType<typeof useStore>;
function Probe() {
  store = useStore();
  return null;
}
beforeEach(() => {
  vi.stubEnv("R2_MEDIA_BUCKET", "synthetic-eu");
  responses.queries = {};
  responses.pages = {};
  responses.calls = [];
  responses.loadMore.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
async function fixture(history = false) {
  const f = await mediaFixture();
  await f.t.run(async (ctx) => {
    for (let i = 0; i < 105; i++)
      await ctx.db.insert("mediaAssets", {
        workspaceId: f.workspaceId,
        storageProvider: "r2",
        objectKey: `old/${i}`,
        checksum: "old",
        name: `Old ${i}`,
        type: "image",
        size: 1,
        state: "ready",
      });
  });
  const old = await f.ready();
  const content = {
    title: "Composer",
    text: ["Text"],
    media: history
      ? [{ assetId: old.assetId, alt: "Exact historical alt" }]
      : [],
    accountId: null,
    pillar: "",
    strategy: "",
  };
  const draftId = await f.signed.mutation(api.editorial.create, {
    workspaceId: f.workspaceId,
    content,
    source: "test",
  });
  if (history) {
    await f.signed.mutation(api.media.assets.setAlt, {
      workspaceId: f.workspaceId,
      assetId: old.assetId,
      alt: "Changed default",
    });
    for (let i = 1; i <= 21; i++)
      await f.signed.mutation(api.editorial.save, {
        workspaceId: f.workspaceId,
        draftId,
        expectedRevision: i,
        content: { ...content, media: [] },
        reason: "Remove",
      });
  }
  const newest = await f.ready();
  responses.queries[getFunctionName(api.users.current)] = await f.signed.query(
    api.users.current,
    {},
  );
  responses.queries[getFunctionName(api.editorial.resources)] =
    await f.signed.query(api.editorial.resources, {
      workspaceId: f.workspaceId,
    });
  responses.queries[getFunctionName(api.editorial.get)] = await f.signed.query(
    api.editorial.get,
    { workspaceId: f.workspaceId, draftId },
  );
  responses.pages[getFunctionName(api.editorial.list)] = (
    await f.signed.query(api.editorial.list, {
      workspaceId: f.workspaceId,
      paginationOpts: { cursor: null, numItems: 25 },
    })
  ).page;
  const first = await f.signed.query(api.editorial.history, {
    workspaceId: f.workspaceId,
    draftId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  const second = first.isDone
    ? []
    : (
        await f.signed.query(api.editorial.history, {
          workspaceId: f.workspaceId,
          draftId,
          paginationOpts: { cursor: first.continueCursor, numItems: 20 },
        })
      ).page;
  responses.pages[getFunctionName(api.editorial.history)] = [
    ...first.page,
    ...second,
  ];
  // History must supply its own descriptors, even before the corresponding inventory page is loaded.
  responses.pages[getFunctionName(api.media.assets.list)] = history
    ? []
    : (
        await f.signed.query(api.media.assets.list, {
          workspaceId: f.workspaceId,
          paginationOpts: { cursor: null, numItems: 50 },
        })
      ).page;
  renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [`/drafts/${draftId}`] },
      createElement(WorkspaceStoreProvider, null, createElement(Probe)),
    ),
  );
  return { f, newest, old, draftId };
}
test("Composer store can first attach newest media beyond the resource limit and load further inventory", async () => {
  const { newest, draftId } = await fixture();
  expect(store.state.media.find((m) => m.id === newest.assetId)).toMatchObject({
    status: "ready",
    alt: "A synthetic fixture",
  });
  expect(store.hasMoreMedia).toBe(true);
  store.loadMoreMedia();
  expect(responses.loadMore).toHaveBeenCalledWith(50);
  expect(
    await store.saveDraft({
      draftId,
      expectedRevision: 1,
      title: "Composer",
      text: ["Text"],
      mediaIds: [newest.assetId],
      accountId: "",
      pillar: "",
      strategy: "",
    }),
  ).toBe(true);
  expect(
    responses.calls.find((c) => c.name === "editorial:save")?.args,
  ).toMatchObject({
    content: {
      media: [{ assetId: newest.assetId, alt: "A synthetic fixture" }],
    },
  });
});
test("Composer store retains paginated historical descriptors for preview and exact-alt restore", async () => {
  const { old, draftId } = await fixture(true);
  const version = store.state.drafts
    .find((d) => d.id === draftId)!
    .versions.find((v) => v.number === 1)!;
  expect(store.state.media.find((m) => m.id === old.assetId)).toMatchObject({
    status: "ready",
    alt: "Changed default",
  });
  expect(version.media).toEqual([
    { assetId: old.assetId, alt: "Exact historical alt" },
  ]);
  await store.saveDraft({
    draftId,
    expectedRevision: 22,
    title: "Composer",
    text: version.text,
    mediaIds: version.mediaIds,
    media: version.media,
    accountId: "",
    pillar: "",
    strategy: "",
  });
  expect(
    responses.calls.find((c) => c.name === "editorial:save")?.args,
  ).toMatchObject({
    content: { media: [{ assetId: old.assetId, alt: "Exact historical alt" }] },
  });
});
