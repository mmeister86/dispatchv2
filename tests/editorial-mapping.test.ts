import { expect, test } from "vitest";
import { editorialContent } from "../src/lib/editorial-mapping";
import { approved, currentVersion, createSeed } from "../src/lib/model";

test("text save preserves the exact draft alt when another draft shares the asset with different alt", () => {
  const state = createSeed();
  const a = structuredClone(state.drafts[0]);
  a.id = "a";
  a.versions.at(-1)!.mediaIds = ["asset"];
  a.versions.at(-1)!.media = [{ assetId: "asset", alt: "Draft A alt" }];
  const b = structuredClone(a);
  b.id = "b";
  b.versions.at(-1)!.media = [{ assetId: "asset", alt: "Draft B alt" }];
  state.drafts = [a, b];
  const input = {
    draftId: a.id,
    title: a.title,
    text: ["Only text changed"],
    mediaIds: ["asset"],
    accountId: a.accountId,
    pillar: a.pillar,
    strategy: a.strategy,
  };
  expect(editorialContent(input, state).media).toEqual([
    { assetId: "asset", alt: "Draft A alt" },
  ]);
  expect(
    editorialContent(
      { ...input, media: [{ assetId: "asset", alt: "Explicit edited alt" }] },
      state,
    ).media[0].alt,
  ).toBe("Explicit edited alt");
  expect(a.versions.at(-1)!.media?.[0].alt).toBe("Draft A alt");
  expect(b.versions.at(-1)!.media?.[0].alt).toBe("Draft B alt");
});

test("native current usability is independent from historical badge and exact current version selection", () => {
  const d = createSeed().drafts[0];
  d.approval = {
    version: d.versions.at(-1)!.number,
    accountId: d.accountId,
    at: new Date().toISOString(),
    by: "owner",
  };
  d.nativeReview = {
    revision: 0,
    policyId: "P2",
    editorial: true,
    brand: true,
    editorialDecisionId: null,
    brandDecisionId: null,
    sourceUntil: null,
    approvalId: null,
    approvalsLimited: false,
  };
  expect(approved(d)).toBe(false);
  expect(d.approval).toBeDefined();
  d.versions[0].id = "original";
  d.currentVersionId = "original";
  expect(currentVersion(d)).toBe(d.versions[0]);
  d.nativeReview.approvalId = "current";
  expect(approved(d)).toBe(true);
  d.nativeReview.sourceUntil = Date.now() - 1;
  expect(approved(d)).toBe(false);
});

test.each([false, true])(
  "stage null/finite/legacy horizons remain distinct from expired approval enabled=%s",
  async (enabled) => {
    const { reviewComplete, reviewStageSourceUntil } =
      await import("../src/lib/model");
    const d = structuredClone(createSeed().drafts[0]);
    currentVersion(d).sourceProofUntil = Date.now() + 900000;
    d.nativeReview = {
      revision: 1,
      policyId: "policy",
      editorial: enabled,
      brand: enabled,
      editorialDecisionId: enabled ? "editorial" : null,
      brandDecisionId: enabled ? "brand" : null,
      sourceUntil: Date.now() - 1,
      approvalId: "expired",
      approvalsLimited: false,
    };
    expect(approved(d)).toBe(false);
    expect(reviewComplete(d)).toBe(false);
    d.nativeReview.stageSourceUntil = null;
    expect(reviewStageSourceUntil(d)).toBeNull();
    expect(reviewComplete(d)).toBe(true);
    expect(approved(d)).toBe(false);
    d.nativeReview.stageSourceUntil = Date.now() + 900000;
    expect(reviewComplete(d)).toBe(true);
    expect(approved(d)).toBe(false);
    d.nativeReview.stageSourceUntil = Date.now() - 1;
    expect(reviewComplete(d)).toBe(false);
  },
);

test("id-less Demo edits select the newest version and preserve frozen schedule content", async () => {
  const { editDraft } = await import("../src/lib/model");
  const state = createSeed();
  const original = state.drafts.find((d) => d.id === "draft-2")!;
  const frozen = structuredClone(
    state.schedules.find((s) => s.draftId === original.id)!,
  );
  expect(approved(original)).toBe(true);
  expect(original.currentVersionId).toBeUndefined();
  expect(original.versions.every((v) => v.id === undefined)).toBe(true);
  const first = editDraft(state, original.id, {}, ["First new text"], []);
  const firstDraft = first.drafts.find((d) => d.id === original.id)!;
  expect(currentVersion(firstDraft).number).toBe(2);
  expect(currentVersion(firstDraft).text).toEqual(["First new text"]);
  expect(approved(firstDraft)).toBe(false);
  const second = editDraft(
    first,
    original.id,
    {},
    ["Second new text"],
    ["media-1"],
  );
  const secondDraft = second.drafts.find((d) => d.id === original.id)!;
  expect(currentVersion(secondDraft).number).toBe(3);
  expect(currentVersion(secondDraft).text).toEqual(["Second new text"]);
  expect(currentVersion(secondDraft).mediaIds).toEqual(["media-1"]);
  expect(approved(secondDraft)).toBe(false);
  expect(secondDraft.versions.map((v) => v.number)).toEqual([1, 2, 3]);
  expect(second.schedules.find((s) => s.id === frozen.id)).toEqual(frozen);
  expect(original.versions).toHaveLength(1);
});

test("current version selects an explicit native ID amid history and falls back only when absent or unmatched", () => {
  const draft = structuredClone(createSeed().drafts[0]);
  const first = { ...draft.versions[0], id: undefined, number: 1 };
  const selected = {
    ...first,
    id: "native-current",
    number: 2,
    text: ["Exact current native text"],
  };
  const laterHistory = { ...first, number: 3, text: ["Later history text"] };
  draft.versions = [first, selected, laterHistory];
  draft.currentVersionId = "native-current";
  expect(currentVersion(draft)).toBe(selected);
  draft.currentVersionId = undefined;
  expect(currentVersion(draft)).toBe(laterHistory);
  draft.currentVersionId = "unmatched";
  expect(currentVersion(draft)).toBe(laterHistory);
});
