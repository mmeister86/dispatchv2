import { expect, test } from "vitest";
import { editorialContent } from "../src/lib/editorial-mapping";
import { createSeed } from "../src/lib/model";

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
