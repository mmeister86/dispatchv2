import type { Doc } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
async function scrubDraft(ctx: MutationCtx, id: Id<"draftVersions">) {
  const ver = await ctx.db.get(id);
  if (!ver?.researchCleanupPending) return;
  await ctx.db.patch(id, {
    content: {
      ...ver.content,
      title: "",
      text: ver.content.text.map(() => ""),
      media: ver.content.media.map((ref) => ({ ...ref, alt: "" })),
      pillar: "",
      strategy: "",
    },
    reason: "",
    sourceUnavailable: true,
    researchCleanupPending: false,
  });
  await ctx.scheduler.runAfter(0, internal.content.feedback.purgeVersion, {
    versionId: id,
  });
  await ctx.scheduler.runAfter(
    0,
    internal.intelligence.assessments.purgeVersion,
    { versionId: id },
  );
  await ctx.scheduler.runAfter(0, internal.research.contentCleanup.comments, {
    versionId: id,
  });
}
export const comments = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialComments")
      .withIndex("by_versionId_and_researchCleanupPending", (q) =>
        q.eq("versionId", a.versionId).eq("researchCleanupPending", true),
      )
      .take(50);
    for (const row of rows)
      await ctx.db.patch(row._id, {
        text: "",
        sourceUnavailable: true,
        researchCleanupPending: false,
      });
    if (rows.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.comments,
        a,
      );
    return null;
  },
});
export const version = internalMutation({
  args: { versionId: v.id("ideaVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const ver = await ctx.db.get(a.versionId);
    if (
      !ver ||
      (ver.source.kind !== "research" && ver.source.kind !== "context-set")
    )
      return null;
    if (ver.researchCleanupPending) {
      await ctx.db.patch(ver._id, {
        title: "",
        note: "",
        perspective: "",
        originals: [],
        rationale: "",
        questions: [],
        sourceUnavailable: true,
        researchCleanupPending: false,
      });
      const idea = await ctx.db.get(ver.ideaId);
      if (idea?.handoff?.ideaVersionId === ver._id)
        await ctx.db.patch(idea._id, {
          handoff: { ...idea.handoff, intent: "", text: "" },
        });
    }
    const feedback = await ctx.db
      .query("ideaFeedback")
      .withIndex("by_versionId_and_researchCleanupPending", (q) =>
        q.eq("versionId", ver._id).eq("researchCleanupPending", true),
      )
      .take(50);
    for (const row of feedback)
      await ctx.db.patch(row._id, {
        text: "",
        sourceUnavailable: true,
        researchCleanupPending: false,
      });
    const drafts = await ctx.db
      .query("draftVersions")
      .withIndex("by_ideaVersionId_and_researchCleanupPending", (q) =>
        q.eq("ideaVersionId", ver._id).eq("researchCleanupPending", true),
      )
      .take(50);
    for (const row of drafts) await scrubDraft(ctx, row._id);
    if (feedback.length === 50 || drafts.length === 50)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.version,
        a,
      );
    return null;
  },
});
export const evidence = internalMutation({
  args: { evidenceId: v.id("researchEvidence") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const bindings = await ctx.db
      .query("researchCopyBindings")
      .withIndex("by_evidenceId_and_state", (q) =>
        q.eq("evidenceId", a.evidenceId).eq("state", "retained"),
      )
      .take(25);
    for (const b of bindings) {
      await ctx.db.patch(b._id, { state: "removed" });
      if (b.conversationId)
        await ctx.scheduler.runAfter(
          0,
          internal.ai.conversations.expireSource,
          { conversationId: b.conversationId },
        );
      if (b.orderId)
        await ctx.scheduler.runAfter(0, internal.research.pipeline.purge, {
          orderId: b.orderId,
        });
      if (b.runId)
        await ctx.scheduler.runAfter(0, internal.ai.runs.purgeSource, {
          runId: b.runId,
        });
      if (b.ideaVersionId)
        await ctx.scheduler.runAfter(
          0,
          internal.research.contentCleanup.version,
          { versionId: b.ideaVersionId },
        );
    }
    const versions = await ctx.db
      .query("ideaVersions")
      .withIndex("by_source_evidenceId_and_researchCleanupPending", (q) =>
        q
          .eq("source.evidenceId", a.evidenceId)
          .eq("researchCleanupPending", true),
      )
      .take(25);
    for (const ver of versions)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.version,
        { versionId: ver._id },
      );
    if (versions.length === 25 || bindings.length === 25)
      await ctx.scheduler.runAfter(
        1000,
        internal.research.contentCleanup.evidence,
        a,
      );
    return null;
  },
});
export const expired = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const versions = await ctx.db
      .query("ideaVersions")
      .withIndex("by_researchCleanupPending_and_researchProofUntil", (q) =>
        q
          .eq("researchCleanupPending", true)
          .lte("researchProofUntil", Date.now()),
      )
      .take(25);
    for (const ver of versions)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.version,
        { versionId: ver._id },
      );
    if (versions.length === 25)
      await ctx.scheduler.runAfter(
        1000,
        internal.research.contentCleanup.expired,
        {},
      );
    return null;
  },
});

export async function registerResearchCopies(
  ctx: MutationCtx,
  source: Doc<"ideaVersions">["source"],
  target: {
    orderId?: Id<"researchOrders">;
    conversationId?: Id<"conversations">;
    ideaVersionId?: Id<"ideaVersions">;
    runId?: Id<"agentRuns">;
  },
) {
  if (Object.values(target).filter(Boolean).length !== 1)
    throw new ConvexError("RESEARCH_COPY_TARGET_INVALID");
  const owner = target.conversationId
    ? await ctx.db.get(target.conversationId)
    : target.ideaVersionId
      ? await ctx.db.get(target.ideaVersionId)
      : target.runId
        ? await ctx.db.get(target.runId)
        : target.orderId
          ? await ctx.db.get(target.orderId)
          : null;
  if (!owner) throw new ConvexError("RESEARCH_COPY_TARGET_INVALID");
  const refs =
    source.kind === "research"
      ? [source]
      : source.kind === "context-set"
        ? source.sources.filter((s) => "kind" in s)
        : [];
  for (const s of refs) {
    const e = await ctx.db.get(s.evidenceId);
    if (
      !e ||
      e.workspaceId !== owner.workspaceId ||
      e.accountId !== s.accountId ||
      ("accountId" in owner && owner.accountId !== s.accountId)
    )
      throw new ConvexError("RESEARCH_COPY_TARGET_INVALID");
    await ctx.db.insert("researchCopyBindings", {
      evidenceId: s.evidenceId,
      ...target,
      state: "retained",
    });
  }
}
