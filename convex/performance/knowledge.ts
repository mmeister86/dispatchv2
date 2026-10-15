import { ConvexError, type Infer } from "convex/values";
import { internal } from "../_generated/api";
import { projection as projectionValidator } from "./modelFields";
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
    const allRows = await ctx.db
      .query("jevAssessments")
      .withIndex("by_draftVersionId", (q) =>
        q.eq("draftVersionId", s.versionId),
      )
      .order("desc")
      .take(20);
    const rows = allRows.filter(
      (r) => r.sourceUntil === null || r.sourceUntil > Date.now(),
    );
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
  let projection: Infer<typeof projectionValidator> = {
    version: "prospective-calibration-v1",
    state: "unavailable",
    score: null,
    reason: "CALIBRATION_NO_CURRENT_ASSESSMENT",
    formulaVersion: "dispatch-score-v1",
    thresholdVersion: "jev-confidence-startup-v1",
    proofUntil: null,
    operatingUntil: null,
    pin: null,
  };
  if (assessment && applicable) {
    // Reserve the publishing tail plus one attempted read overflow; exhausted children charge their parent.
    const metrics = await ctx.meta.getTransactionMetrics(),
      transactionLimits = {
        databaseQueries: metrics.databaseQueries.remaining - 33,
        documentsRead: metrics.documentsRead.remaining - 65,
        bytesRead: metrics.bytesRead.remaining - 2 * 1024 * 1024,
      };
    projection = {
      ...projection,
      state: "static",
      reason: "CALIBRATION_PROJECTION_PROOF_CAPACITY",
    };
    if (
      Object.values(transactionLimits).every(
        (n) => Number.isSafeInteger(n) && n > 0,
      )
    ) {
      try {
        projection = await ctx.runQuery(
          internal.performance.models.projection,
          {
            workspaceId: s.workspaceId,
            accountId: s.accountId,
            actorId: s.actorId,
            assessmentId: assessment._id,
          },
          { transactionLimits },
        );
      } catch (err) {
        const code =
          err instanceof ConvexError
            ? String(err.data)
            : err instanceof Error
              ? err.message
              : "";
        const capacity =
          code === "CALIBRATION_READ_CAPACITY" ||
          /limit|too many|too much|capacity/i.test(code);
        projection = {
          ...projection,
          state: capacity ? "static" : "unavailable",
          reason: capacity
            ? "CALIBRATION_PROJECTION_PROOF_CAPACITY"
            : "CALIBRATION_PROJECTION_UNAVAILABLE",
        };
      }
    }
    // The original assessment already owns its static scalar; store only the candidate derivative.
    if (projection.state !== "candidate")
      projection = { ...projection, score: null, pin: null };
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
    projection,
  });
}
