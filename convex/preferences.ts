import { ConvexError, v, type Infer } from "convex/values";
import {
  profile,
  notificationPreference,
  personalNotificationSettings,
} from "./schema";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireReference,
} from "./lib/authorization";
export const save = workspaceMutation({
  args: {
    profile,
    project: v.optional(
      v.object({ name: v.string(), description: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const p = args.profile;
    if (
      !p.name.trim() ||
      p.name.length > 100 ||
      p.audience.length > 4000 ||
      p.topics.length > 4000 ||
      p.tone.length > 500 ||
      !Number.isInteger(p.onboardingStep) ||
      p.onboardingStep < 0 ||
      p.onboardingStep > 3
    )
      throw new ConvexError("INVALID_PROFILE");
    try {
      new Intl.DateTimeFormat("en", { timeZone: p.timezone });
    } catch {
      throw new ConvexError("INVALID_TIMEZONE");
    }
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
      )
      .unique();
    requireReference(ctx.workspace._id, existing);
    if (args.project) {
      requireRole(ctx.membership, ["Owner", "Admin"]);
      if (
        !args.project.name.trim() ||
        args.project.name.length > 100 ||
        args.project.description.length > 2000
      )
        throw new ConvexError("INVALID_WORKSPACE");
      await ctx.db.patch(ctx.workspace._id, {
        name: args.project.name.trim(),
        description: args.project.description.trim(),
      });
    }
    await ctx.db.patch(existing!._id, { ...p, name: p.name.trim() });
    return null;
  },
});

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
const notificationArgs = { expectedAuthId: v.string(), requestKey: v.string() };
const notificationResult = v.object({
  authId: v.string(),
  sessionId: v.string(),
  workspaceId: v.id("workspaces"),
  requestKey: v.string(),
  settings: personalNotificationSettings,
});
type Intent = Infer<typeof notificationPreference>;
function intent(s: Intent): Intent {
  return {
    email: s.email,
    inAppSummaries: s.inAppSummaries,
    weekly: s.weekly,
    research: s.research,
    timezone: s.timezone,
    quiet: s.quiet === null ? null : { start: s.quiet.start, end: s.quiet.end },
  };
}
function validateIntent(s: Intent) {
  if (!s.timezone || s.timezone.length > 100)
    throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
  try {
    const zone = new Intl.DateTimeFormat("en", {
      timeZone: s.timezone,
    }).resolvedOptions().timeZone;
    if (/^[+-]/.test(zone))
      throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
  } catch {
    throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
  }
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    s.quiet &&
    (!clock.test(s.quiet.start) ||
      !clock.test(s.quiet.end) ||
      s.quiet.start === s.quiet.end)
  )
    throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
}
export async function ownNotificationRow(
  ctx: (QueryCtx | MutationCtx) & {
    user: Doc<"users">;
    workspace: Doc<"workspaces">;
  },
  a: { expectedAuthId: string; requestKey: string },
) {
  if (
    !a.requestKey ||
    a.requestKey.length > 64 ||
    !a.expectedAuthId ||
    a.expectedAuthId.length > 256
  )
    throw new ConvexError("NOTIFICATION_REQUEST_INVALID");
  if (
    ctx.user.authId !== a.expectedAuthId ||
    ctx.user.activeWorkspaceId !== ctx.workspace._id
  )
    throw new ConvexError("NOTIFICATION_SCOPE_CHANGED");
  const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
  if (typeof sessionId !== "string" || !sessionId)
    throw new ConvexError("Unauthenticated");
  const p = await ctx.db
    .query("preferences")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
    )
    .unique();
  if (!p) throw new ConvexError("NOTIFICATION_PROFILE_UNAVAILABLE");
  const settings = p.notifications ?? {
    revision: 0,
    email: false,
    inAppSummaries: false,
    weekly: false,
    research: false,
    timezone: "UTC",
    quiet: null,
  };
  if (!Number.isSafeInteger(settings.revision) || settings.revision < 0)
    throw new ConvexError("NOTIFICATION_REVISION_INVALID");
  validateIntent(settings);
  return {
    p,
    sessionId,
    settings: { revision: settings.revision, ...intent(settings) },
  };
}
export const notifications = workspaceQuery({
  args: notificationArgs,
  returns: notificationResult,
  handler: async (ctx, a) => {
    const { sessionId, settings } = await ownNotificationRow(ctx, a);
    return {
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      requestKey: a.requestKey,
      settings,
    };
  },
});
export const saveNotifications = workspaceMutation({
  args: {
    ...notificationArgs,
    expectedRevision: v.number(),
    settings: notificationPreference,
  },
  returns: notificationResult,
  handler: async (ctx, a) => {
    if (!Number.isSafeInteger(a.expectedRevision) || a.expectedRevision < 0)
      throw new ConvexError("NOTIFICATION_REVISION_INVALID");
    const {
      p,
      sessionId,
      settings: current,
    } = await ownNotificationRow(ctx, a);
    validateIntent(a.settings);
    const desired = intent(a.settings);
    let settings = current;
    if (JSON.stringify(intent(current)) !== JSON.stringify(desired)) {
      if (a.expectedRevision !== current.revision)
        throw new ConvexError("NOTIFICATION_REVISION_CONFLICT");
      if (current.revision === Number.MAX_SAFE_INTEGER)
        throw new ConvexError("NOTIFICATION_REVISION_OVERFLOW");
      settings = { revision: current.revision + 1, ...desired };
      await recomputeResearchSummaries(ctx, p, settings);
      await ctx.db.patch(p._id, { notifications: settings });
    }
    return {
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      requestKey: a.requestKey,
      settings,
    };
  },
});

import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireWorkspace } from "./lib/authorization";
import { rethrowUnexpectedSourceError } from "./lib/sourceProof";
import { sourceAuthority } from "./research/providerAccess";
import { deliveredSource, currentEvidence } from "./research/evidence";
import { currentMaterialProof } from "./research/pipelineAccess";
import { quietWindow } from "./research/time";
type Entry = NonNullable<Doc<"preferences">["researchSummaries"]>[number];
function entryClock(r: Entry) {
  for (const n of [
    r.finishedAt,
    r.deadline,
    r.sourceUntil,
    r.availableAt,
    r.generation,
  ])
    if (!Number.isSafeInteger(n) || n < 0)
      throw new ConvexError("RESEARCH_SUMMARY_CLOCK_INVALID");
  if (r.deadline > r.finishedAt + 26 * 3600000 || r.deadline > r.sourceUntil)
    throw new ConvexError("RESEARCH_SUMMARY_CLOCK_INVALID");
  return r;
}
const enabled = (p: Doc<"preferences">) =>
  !!p.notifications?.inAppSummaries && !!p.notifications.research;
function expectedLoss(e: unknown) {
  // Ancestry/resource failures are failures, never successful source loss.
  if (
    e instanceof ConvexError &&
    ["RESEARCH_PROOF_ANCESTRY_LIMIT", "STYLE_ANCESTRY_LIMIT"].includes(
      String(e.data),
    )
  )
    throw e;
  rethrowUnexpectedSourceError(e);
}
async function completionProof(
  ctx: QueryCtx | MutationCtx,
  o: Doc<"researchOrders">,
) {
  if (!o.native || o.targetedChat) return null;
  if (o.pipeline?.runId) {
    const run = await ctx.db.get(o.pipeline.runId);
    if (run?.conversationId || run?.chatOperationId) return null;
  }
  const actor = await ctx.db.get(o.actorId),
    p = await ctx.db.get(o.profileId),
    version = await ctx.db.get(o.profileVersionId);
  if (
    !actor ||
    !p ||
    !version ||
    p.paused ||
    p.deleted ||
    p.accountId !== o.accountId ||
    version.profileId !== p._id ||
    p.workspaceId !== o.workspaceId ||
    version.workspaceId !== o.workspaceId
  )
    return null;
  await requireWorkspace(ctx, o.workspaceId, actor);
  let until = Number.MAX_SAFE_INTEGER;
  for (const op of o.native.operations) {
    const { p: policy, captured } = await sourceAuthority(ctx, o, op);
    until = Math.min(until, policy.expiresAt, policy.lifecycleValidUntil);
    for (const id of captured.budgetIds)
      until = Math.min(until, (await ctx.db.get(id))!.expiresAt);
    const cacheId = o.native.cacheIds[o.native.operations.indexOf(op)];
    const c = cacheId ? await ctx.db.get(cacheId) : null;
    const outcome = o.native.outcomes[o.native.operations.indexOf(op)];
    if (
      ["completed", "partial"].includes(outcome.state) &&
      (!c || !["completed", "partial"].includes(c.state) || !c.sourceIds.length)
    )
      throw new ConvexError("RESEARCH_EVIDENCE_NOT_DELIVERED");
    if (c) {
      for (const id of c.sourceIds)
        until = Math.min(until, (await deliveredSource(ctx, o._id, id)).until);
    }
  }
  if (o.pipeline) {
    until = Math.min(until, (await currentMaterialProof(ctx, o)).proofUntil);
    for (const id of o.pipeline.evidenceIds)
      until = Math.min(
        until,
        (await currentEvidence(ctx, o.workspaceId, id, o.accountId)).proofUntil,
      );
  }
  if (!Number.isSafeInteger(until))
    throw new ConvexError("RESEARCH_SUMMARY_CLOCK_INVALID");
  if (until <= Date.now()) return null;
  return until;
}
async function cancelSummaryJob(ctx: MutationCtx, id: Entry["job"]) {
  const job = await ctx.db.system.get(id);
  if (job?.state.kind === "pending") await ctx.scheduler.cancel(id);
}
async function replaceSummaries(
  ctx: MutationCtx,
  p: Doc<"preferences">,
  rows: Entry[],
  epoch = p.summaryEpoch ?? 0,
) {
  const keep = new Set(rows.map((r) => r.orderId));
  for (const r of p.researchSummaries ?? [])
    if (!keep.has(r.orderId)) {
      await cancelSummaryJob(ctx, r.job);
      await cancelSummaryJob(ctx, r.expiryJob);
    }
  await ctx.db.patch(p._id, {
    researchSummaries: rows.length ? rows : undefined,
    activeSummary: rows.length ? true : undefined,
    summaryEpoch: epoch,
  });
}
export async function admitResearchCompletion(
  ctx: MutationCtx,
  o: Doc<"researchOrders">,
  finishedAt: number,
) {
  // Only the genuine transition caller admits; there is no independently replayable admission endpoint.
  if (!o.native || o.targetedChat || !["queued", "running"].includes(o.state))
    return;
  if (o.pipeline?.runId) {
    const r = await ctx.db.get(o.pipeline.runId);
    if (r?.conversationId || r?.chatOperationId) return;
  }
  const p = await ctx.db
    .query("preferences")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", o.actorId).eq("workspaceId", o.workspaceId),
    )
    .unique();
  if (!p || !enabled(p)) return;
  const rows = (p.researchSummaries ?? [])
    .map(entryClock)
    .filter((r) => r.deadline > Date.now());
  if (rows.length >= 5) return;
  let sourceUntil;
  try {
    sourceUntil = await completionProof(ctx, o);
  } catch (e) {
    expectedLoss(e);
    return;
  }
  if (sourceUntil === null) return;
  const deadline = Math.min(finishedAt + 26 * 3600000, sourceUntil),
    epoch = p.summaryEpoch ?? 0;
  const quiet = quietWindow(p.notifications!, finishedAt),
    availableAt = quiet.availableAt;
  if (availableAt >= deadline) return;
  const job = await ctx.scheduler.runAt(
    availableAt,
    internal.preferences.releaseResearchSummary,
    { preferenceId: p._id, orderId: o._id, epoch },
  );
  const expiryJob = await ctx.scheduler.runAt(
    deadline,
    internal.preferences.expireResearchSummary,
    { preferenceId: p._id, orderId: o._id, finishedAt },
  );
  await replaceSummaries(ctx, p, [
    ...rows,
    {
      orderId: o._id,
      generation: o.generation,
      accountId: o.accountId,
      profileId: o.profileId,
      profileVersionId: o.profileVersionId,
      finishedAt,
      deadline,
      sourceUntil,
      availableAt,
      job,
      expiryJob,
    },
  ]);
}
export async function retainedEntry(
  ctx: QueryCtx | MutationCtx,
  p: Doc<"preferences">,
  r: Entry,
) {
  entryClock(r);
  if (!enabled(p) || r.deadline <= Date.now()) return null;
  const o = await ctx.db.get(r.orderId);
  if (
    !o ||
    o.actorId !== p.userId ||
    o.workspaceId !== p.workspaceId ||
    o.state !== "completed" ||
    o.generation !== r.generation ||
    o.finishedAt !== r.finishedAt ||
    o.profileId !== r.profileId ||
    o.profileVersionId !== r.profileVersionId ||
    o.accountId !== r.accountId
  )
    return null;
  try {
    const until = await completionProof(ctx, o);
    return until === null
      ? null
      : { o, until: Math.min(until, r.deadline, r.sourceUntil) };
  } catch (e) {
    expectedLoss(e);
    return null;
  }
}
export const expireResearchSummary = internalMutation({
  args: {
    preferenceId: v.id("preferences"),
    orderId: v.id("researchOrders"),
    finishedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.preferenceId);
    if (p)
      await replaceSummaries(
        ctx,
        p,
        (p.researchSummaries ?? []).filter(
          (r) =>
            r.orderId !== a.orderId ||
            r.finishedAt !== a.finishedAt ||
            r.deadline > Date.now(),
        ),
      );
    return null;
  },
});
export const releaseResearchSummary = internalMutation({
  args: {
    preferenceId: v.id("preferences"),
    orderId: v.id("researchOrders"),
    epoch: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.preferenceId);
    if (!p || (p.summaryEpoch ?? 0) !== a.epoch) return null;
    const r = p.researchSummaries?.find((r) => r.orderId === a.orderId);
    if (!r) return null;
    const proof = await retainedEntry(ctx, p, r);
    if (!proof) {
      await replaceSummaries(
        ctx,
        p,
        p.researchSummaries!.filter((x) => x !== r),
      );
      return null;
    }
    const now = Date.now(),
      quiet = quietWindow(p.notifications!, now),
      availableAt = quiet.availableAt;
    if (availableAt >= r.deadline) {
      await replaceSummaries(
        ctx,
        p,
        p.researchSummaries!.filter((x) => x !== r),
      );
      return null;
    }
    const nextAt = availableAt > now ? availableAt : quiet.boundary;
    await cancelSummaryJob(ctx, r.job);
    const job =
      nextAt !== null && nextAt < r.deadline
        ? await ctx.scheduler.runAt(
            nextAt,
            internal.preferences.releaseResearchSummary,
            a,
          )
        : r.job;
    await ctx.db.patch(p._id, {
      researchSummaries: p.researchSummaries!.map((x) =>
        x === r ? { ...r, availableAt, job } : x,
      ),
    });
    return null;
  },
});
const summaryArgs = { ...notificationArgs, expectedSessionId: v.string() };
async function summaryOwner(
  ctx: Parameters<typeof ownNotificationRow>[0],
  a: { expectedAuthId: string; requestKey: string; expectedSessionId: string },
) {
  const own = await ownNotificationRow(ctx, a);
  if (own.sessionId !== a.expectedSessionId)
    throw new ConvexError("NOTIFICATION_SCOPE_CHANGED");
  return own;
}
const observed = v.object({
  orderId: v.id("researchOrders"),
  generation: v.number(),
  finishedAt: v.number(),
});
const summaryRow = v.object({
  ...observed.fields,
  accountId: v.id("socialAccounts"),
  outcome: v.string(),
  proofUntil: v.number(),
});
export const researchSummaries = workspaceQuery({
  args: summaryArgs,
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    workspaceId: v.id("workspaces"),
    requestKey: v.string(),
    rows: v.array(summaryRow),
    coverage: v.literal("bounded_unknown"),
  }),
  handler: async (ctx, a) => {
    const { p, sessionId, settings } = await summaryOwner(ctx, a),
      rows: Infer<typeof summaryRow>[] = [];
    if (enabled(p)) {
      const quiet = quietWindow(settings, Date.now());
      if (quiet.availableAt <= Date.now())
        for (const r of (p.researchSummaries ?? []).slice(0, 5)) {
          if (r.availableAt > Date.now()) continue;
          const proof = await retainedEntry(ctx, p, r);
          if (!proof) continue;
          const outcome =
            proof.o.pipeline?.outcome ??
            (proof.o.native!.outcomes.some((x) => x.state === "partial")
              ? "partial"
              : proof.o.native!.outcomes.some(
                    (x) => !["completed", "empty"].includes(x.state),
                  )
                ? proof.o.native!.outcomes.some((x) => x.state === "completed")
                  ? "partial"
                  : "failed"
                : proof.o.native!.outcomes.some((x) => x.state === "completed")
                  ? "completed"
                  : "empty");
          rows.push({
            orderId: r.orderId,
            generation: r.generation,
            finishedAt: r.finishedAt,
            accountId: r.accountId,
            outcome,
            proofUntil: Math.min(proof.until, quiet.boundary ?? Infinity),
          });
        }
    }
    return {
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      requestKey: a.requestKey,
      rows,
      coverage: "bounded_unknown" as const,
    };
  },
});
export const dismissResearchSummaries = workspaceMutation({
  args: { ...summaryArgs, observed: v.array(observed) },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.observed.length > 5)
      throw new ConvexError("NOTIFICATION_REQUEST_INVALID");
    const { p } = await summaryOwner(ctx, a);
    const remove = new Set<string>();
    for (const r of p.researchSummaries ?? [])
      if (
        a.observed.some(
          (x) =>
            x.orderId === r.orderId &&
            x.generation === r.generation &&
            x.finishedAt === r.finishedAt,
        )
      ) {
        const proof = await retainedEntry(ctx, p, r);
        if (
          proof &&
          r.availableAt <= Date.now() &&
          quietWindow(p.notifications!, Date.now()).availableAt <= Date.now()
        )
          remove.add(r.orderId);
      }
    await replaceSummaries(
      ctx,
      p,
      (p.researchSummaries ?? []).filter((r) => !remove.has(r.orderId)),
    );
    return null;
  },
});
export async function recomputeResearchSummaries(
  ctx: MutationCtx,
  p: Doc<"preferences">,
  settings: Infer<typeof personalNotificationSettings>,
) {
  const epoch = (p.summaryEpoch ?? 0) + 1,
    rows: Entry[] = [];
  for (const r of p.researchSummaries ?? []) {
    await cancelSummaryJob(ctx, r.job);
    if (
      !settings.inAppSummaries ||
      !settings.research ||
      r.deadline <= Date.now()
    )
      continue;
    const availableAt = quietWindow(settings, Date.now()).availableAt;
    if (availableAt >= r.deadline) continue;
    const job = await ctx.scheduler.runAt(
      availableAt,
      internal.preferences.releaseResearchSummary,
      { preferenceId: p._id, orderId: r.orderId, epoch },
    );
    rows.push({ ...r, availableAt, job });
  }
  await replaceSummaries(ctx, p, rows, epoch);
}
export const sweepResearchSummaries = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("preferences")
      .withIndex("by_workspaceId_and_activeSummary")
      .paginate({ cursor: a.cursor, numItems: 10 });
    for (const p of page.page)
      if (p.activeSummary) {
        const live = (p.researchSummaries ?? [])
          .map(entryClock)
          .filter((r) => r.deadline > Date.now());
        await replaceSummaries(ctx, p, live);
        if (live.length)
          await ctx.scheduler.runAfter(
            0,
            internal.preferences.scrubResearchSummaries,
            { preferenceId: p._id },
          );
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.preferences.sweepResearchSummaries,
        { cursor: page.continueCursor },
      );
    return null;
  },
});
export const scrubResearchSummaries = internalMutation({
  args: { preferenceId: v.id("preferences") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.preferenceId);
    if (!p) return null;
    const rows: Entry[] = [];
    for (const r of p.researchSummaries ?? [])
      if (await retainedEntry(ctx, p, r)) rows.push(r);
    await replaceSummaries(ctx, p, rows);
    return null;
  },
});

export const scrubActorResearchSummaries = internalMutation({
  args: { actorId: v.id("users"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) => q.eq("userId", a.actorId))
      .paginate({ cursor: a.cursor, numItems: 50 });
    for (const p of page.page)
      if (p.activeSummary)
        await ctx.scheduler.runAfter(
          0,
          internal.preferences.scrubResearchSummaries,
          { preferenceId: p._id },
        );
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.preferences.scrubActorResearchSummaries,
        { actorId: a.actorId, cursor: page.continueCursor },
      );
    return null;
  },
});
