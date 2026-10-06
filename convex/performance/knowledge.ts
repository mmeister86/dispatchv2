import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { draftResearchProof } from "../research/contentProof";
import { current } from "../ai/jev/access";
import { request } from "../intelligence/assessments";
import { sha256 } from "../lib/crypto";
// Bind immutable normalized assessment by ID; no second protected semantic payload copy.
export async function capture(
  ctx: MutationCtx,
  s: Doc<"schedules">,
  account: Doc<"socialAccounts">,
  attempt: Doc<"xPostAttempts">,
) {
  const old = await ctx.db
    .query("publicationKnowledge")
    .withIndex("by_postAttemptId", (q) => q.eq("postAttemptId", attempt._id))
    .unique();
  if (old) return;
  const ver = await ctx.db.get(s.versionId);
  let assessment: Doc<"jevAssessments"> | null = null,
    applicable = false,
    reason: string | null = "NO_ASSESSMENT_AT_PUBLISH";
  try {
    if (!ver || ver.sourceUnavailable) throw new Error("SOURCE_UNAVAILABLE");
    await draftResearchProof(ctx, ver);
    const rows = await ctx.db
      .query("jevAssessments")
      .withIndex("by_draftVersionId", (q) =>
        q.eq("draftVersionId", s.versionId),
      )
      .order("desc")
      .take(20);
    assessment =
      rows.find(
        (r) =>
          r.workspaceId === s.workspaceId &&
          r.accountId === s.accountId &&
          r.draftId === s.draftId &&
          r.createdAt <= Date.now(),
      ) ?? null;
    if (assessment) {
      reason = "RETAINED_ASSESSMENT_NOT_CURRENT";
      try {
        const x = await current(
          ctx,
          await request(
            ctx,
            s.workspaceId,
            s.actorId,
            {
              accountId: s.accountId,
              draftId: s.draftId,
              draftVersionId: s.versionId,
            },
            "publication-knowledge-v1",
          ),
        );
        const matched = rows.find(
          (r) =>
            r.semanticKey === x.semanticKey &&
            r.workspaceId === s.workspaceId &&
            r.accountId === s.accountId &&
            r.draftId === s.draftId,
        );
        const receipt = matched ? await ctx.db.get(matched.attemptId) : null;
        if (
          matched &&
          receipt?.owner === "jev-analyzer" &&
          receipt.policyFingerprint === (await sha256(JSON.stringify(x.p)))
        ) {
          assessment = matched;
          applicable = true;
          reason = null;
        }
      } catch {
        /* Publication remains permitted without current analysis processing. */
      }
    }
  } catch {
    assessment = null;
    reason = "ASSESSMENT_SOURCE_UNAVAILABLE";
  }
  await ctx.db.insert("publicationKnowledge", {
    workspaceId: s.workspaceId,
    accountId: s.accountId,
    scheduleId: s._id,
    postAttemptId: attempt._id,
    generation: attempt.generation,
    versionId: s.versionId,
    providerIdentity: account.providerIdentity,
    network: "x",
    capturedAt: Date.now(),
    assessmentId: assessment?._id ?? null,
    applicable,
    reason,
  });
}
