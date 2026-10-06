import { v } from "convex/values";
import { begin, finish, replay, updateProof } from "./profiles";
import { workspaceMutation } from "../lib/authorization";
import { commandArgs, result } from "./sharedFields";
// This pinned report is candidate content. Its source review is not current account activation.
export const manifest = [
  [
    "README.md",
    "78cfe634123654bf5da0dec8a2b10a48d683cb4b42cc3f0e95a3fc362c659010",
  ],
  [
    "phoenix/README.md",
    "01fe6fece2893023b4d64c60ff7e5030d5fabaf892898e6ce95b7818974a7910",
  ],
  [
    "home-mixer/scorers/value_model.rs",
    "58f4bf4f268d7f2f41652202becfbfed18668b23e17180f7f43c5bff5253ddda",
  ],
  [
    "xai-value-model/scoring.rs",
    "647df981a3d8ec9f5a46b0691622e523c84d242da9eab43693be05bd6bbcf035",
  ],
  [
    "home-mixer/params/param.rs",
    "fa2880ce4f5efe4197442a98a79ca3511195582c6f89c17939395a7750640e1e",
  ],
  [
    "home-mixer/params/config.rs",
    "029567d6d5ff100ebc43160feda15225fc2910862a790dc89648f90bc97153ca",
  ],
  [
    "home-mixer/filters/age_filter.rs",
    "8b071a27cfcadbcc2cdeee6b9b2c58a4eafc55d5eedae37f02abd028f106739e",
  ],
  [
    "home-mixer/filters/drop_duplicates_filter.rs",
    "8b0a5e750c5d8ac44d0129a2c2b293a375f4d3a38dfb5510e2671791b010c91f",
  ],
  [
    "home-mixer/candidate_pipeline/phoenix_candidate_pipeline.rs",
    "508fe2c90adc05f1fbea396da4bd57a348cf79c068e6d2802349002c210aa34e",
  ],
  [
    "visibility-filtering/rules/registry.rs",
    "19a5ced98340ce6b59926ab047fabf48bcf03ba5fd581c937e38131eff7e5690",
  ],
  [
    "home-mixer/scorers/vm_ranker.rs",
    "eebd41c03fa9ca32292fd327114c5f7b9cbeb3104f79bef67ffcf96ae4e946c5",
  ],
  [
    "vm-ranker/scoring/value_model.rs",
    "c0f854c5e6f99c835669740534c59de54005a2d1436dcc17cb0eb07fca7f1fd4",
  ],
  [
    "vm-ranker/ranking_config.rs",
    "e2ed8fcf0ea24229644b9077094cf00fa6bef5c431d729074c8d375059b4ce9c",
  ],
];
const commit = "b412112d03f27acbfd668e0cc040abcafa1080c1" as const;
export const create = workspaceMutation({
  args: {
    ...commandArgs,
    proposalId: v.optional(v.id("intelligenceSourceUpdates")),
    evaluationId: v.optional(v.id("intelligenceSourceUpdates")),
    variant: v.optional(
      v.union(v.literal("public-context"), v.literal("post-analysis")),
    ),
  },
  returns: result,
  handler: async (ctx, a) => {
    const b = await begin(ctx, a, { kind: "create-algorithm", ...a });
    if (b.receipt) return replay(b.receipt);
    const refs = {
      formula: "dispatch-score-v1" as const,
      routing: "disabled-v1" as const,
      verification: "disabled-v1" as const,
    };
    const executable = a.variant === "post-analysis";
    const variantPayload = executable
      ? {
          version: "x-post-analysis-v1" as const,
          refs: {
            ...refs,
            questionSet: "jev-post-analysis-v1" as const,
            normalization: "jev-normalization-v1" as const,
          },
        }
      : {
          version: "x-public-context-v1" as const,
          refs: {
            ...refs,
            questionSet: "unavailable-until-task28" as const,
            normalization: "unavailable-until-task28" as const,
          },
        };
    const candidate: Omit<
      import("../_generated/dataModel").Doc<"algorithmProfiles">,
      "_id" | "_creationTime"
    > = {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      network: "x",
      surface: "for_you",
      createdBy: ctx.user._id,
      createdAt: Date.now(),
      status: "draft",
      review: null,
      retiredAt: null,
      payload: {
        ...variantPayload,
        repository: "xai-org/x-algorithm",
        commit,
        commitAt: Date.parse("2026-10-03T03:26:56Z"),
        observedAt: Date.parse("2026-10-05T09:42:27Z"),
        reviewDueAt: Date.parse("2026-10-12T00:00:00Z"),
        validityBasis: "operational_assumption",
        sourceScope: "public_code",
        productionState: "unknown",
        scoringInfluence: "none",
        evidence: manifest.map(([path, sha256]) => ({
          path,
          sha256,
          url: `https://github.com/xai-org/x-algorithm/blob/${commit}/${path}`,
        })),
        report: ".docs/reviews/task-27-44-public-x-source-review.md",
      },
    };
    if (!!a.proposalId !== !!a.evaluationId)
      throw new Error("INTELLIGENCE_SOURCE_REVIEW_REQUIRED");
    let update;
    if (a.proposalId && a.evaluationId) {
      const proposal = await ctx.db.get(a.proposalId),
        evaluation = await ctx.db.get(a.evaluationId);
      if (
        !proposal ||
        proposal.kind !== "proposal" ||
        !evaluation ||
        evaluation.kind !== "evaluation"
      )
        throw new Error("INTELLIGENCE_SOURCE_REVIEW_REQUIRED");
      const observation = proposal.observation;
      candidate.payload = {
        ...candidate.payload,
        commit: observation.commit,
        commitAt: observation.commitAt,
        observedAt: observation.observedAt,
        reviewDueAt: observation.reviewDueAt,
        evidence: observation.evidence,
        report: `source-proposal:${proposal._id};evaluation:${evaluation._id}`,
      };
      update = { proposalId: proposal._id, evaluationId: evaluation._id };
      if (
        !(await updateProof(ctx, {
          ...candidate,
          update,
        } as import("../_generated/dataModel").Doc<"algorithmProfiles">))
      )
        throw new Error("INTELLIGENCE_SOURCE_REVIEW_REQUIRED");
    }
    const algorithmId = await ctx.db.insert("algorithmProfiles", {
      ...candidate,
      ...(update ? { update } : {}),
    });
    return finish(
      ctx,
      a,
      b,
      "create-algorithm",
      a.variant === "post-analysis"
        ? "Explicit post-analysis rubric candidate; public context has no score influence"
        : "Pinned public report candidate",
      { algorithmId, audienceId: null },
    );
  },
});
