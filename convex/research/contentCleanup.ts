import type { Doc } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
async function scrubDraft(ctx: MutationCtx, id: Id<"draftVersions">) {
  const ver = await ctx.db.get(id);
  if (!ver || (!ver.researchCleanupPending && !ver.sourceUnavailable)) return;
  await ctx.scheduler.runAfter(0, internal.editorial.reviews.purgeVersion, {
    versionId: id,
  });
  await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
    draftVersionId: id,
  });
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
  await ctx.scheduler.runAfter(
    0,
    internal.research.contentCleanup.draftCopies,
    { versionId: id },
  );
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
  args: {
    versionId: v.id("ideaVersions"),
    family: v.optional(v.union(v.literal("ideas"), v.literal("requests"))),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const ver = await ctx.db.get(a.versionId);
    if (!a.family)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.semanticDrafts,
        { versionId: a.versionId, cursor: null },
      );
    if (
      !ver ||
      ver.sourceCleanupState === "complete" ||
      (!ver.researchCleanupPending && !ver.sourceUnavailable)
    )
      return null;
    if (a.family === "ideas") {
      const page = await ctx.db
        .query("ideaVersions")
        .withIndex("by_inputVersionId", (q) => q.eq("inputVersionId", ver._id))
        .paginate({ numItems: 25, cursor: a.cursor ?? null });
      for (const child of page.page)
        await ctx.scheduler.runAfter(
          0,
          internal.research.contentCleanup.version,
          { versionId: child._id },
        );
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.version,
        page.isDone
          ? { versionId: ver._id, family: "requests", cursor: null }
          : { ...a, cursor: page.continueCursor },
      );
      return null;
    }
    if (a.family === "requests") {
      const page = await ctx.db
        .query("contentRequests")
        .withIndex("by_inputVersionId", (q) => q.eq("inputVersionId", ver._id))
        .paginate({ numItems: 25, cursor: a.cursor ?? null });
      for (const request of page.page)
        await ctx.scheduler.runAfter(0, internal.ai.runs.purgeSource, {
          runId: request.runId,
        });
      if (!page.isDone)
        await ctx.scheduler.runAfter(
          0,
          internal.research.contentCleanup.version,
          { ...a, cursor: page.continueCursor },
        );
      else await ctx.db.patch(ver._id, { sourceCleanupState: "complete" });
      return null;
    }
    if (ver.researchCleanupPending) {
      await ctx.db.patch(ver._id, {
        title: "",
        note: "",
        perspective: "",
        originals: [],
        rationale: "",
        questions: [],
        sourceUnavailable: true,
        sourceCleanupState: "pending",
        researchCleanupPending: false,
      });
      const idea = await ctx.db.get(ver.ideaId);
      if (idea?.handoff?.ideaVersionId === ver._id)
        await ctx.db.patch(idea._id, {
          handoff: { ...idea.handoff, intent: "", text: "" },
        });
    }
    const copies = await ctx.db
      .query("ideaRunCopies")
      .withIndex("by_ideaVersionId_and_state", (q) =>
        q.eq("ideaVersionId", ver._id).eq("state", "retained"),
      )
      .take(25);
    for (const copy of copies) {
      await ctx.db.patch(copy._id, { state: "removed" });
      await ctx.scheduler.runAfter(0, internal.ai.runs.purgeSource, {
        runId: copy.runId,
      });
      if (copy.conversationId)
        await ctx.scheduler.runAfter(
          0,
          internal.ai.conversations.expireSource,
          { conversationId: copy.conversationId },
        );
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
    if (feedback.length === 50 || drafts.length === 50 || copies.length === 25)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.version,
        a,
      );
    else
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.version,
        { versionId: ver._id, family: "ideas", cursor: null },
      );
    return null;
  },
});
export const draftCopies = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("draftResearchCopies")
      .withIndex("by_draftVersionId_and_state", (q) =>
        q.eq("draftVersionId", a.versionId).eq("state", "retained"),
      )
      .take(25);
    for (const row of rows) {
      await ctx.db.patch(row._id, { state: "removed" });
      await ctx.scheduler.runAfter(0, internal.research.pipeline.purge, {
        orderId: row.orderId,
      });
    }
    if (rows.length === 25)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.draftCopies,
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
          .gte("researchProofUntil", Number.MIN_SAFE_INTEGER)
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

// The protected derivative edge is independent of whether an older cleanup already scrubbed the root.
export const semanticDrafts = internalMutation({
  args: {
    versionId: v.id("ideaVersions"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("draftVersions")
      .withIndex("by_ideaVersionId", (q) => q.eq("ideaVersionId", a.versionId))
      .paginate({ cursor: a.cursor, numItems: 25 });
    const root = await ctx.db.get(a.versionId);
    for (const row of page.page) {
      if (!root || root.sourceUnavailable)
        await ctx.scheduler.runAfter(
          0,
          internal.editorial.reviews.purgeVersion,
          { versionId: row._id },
        );
      await ctx.scheduler.runAfter(0, internal.content.similarity.purge, {
        draftVersionId: row._id,
      });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.research.contentCleanup.semanticDrafts,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
