import { currentReview, sameReview, isReviewLoss } from "../editorial/reviews";
import { seriesPlanProof, sourceLoss } from "./strategy";
import {
  cosine,
  vectorFingerprint,
  type preparedFrame,
} from "../content/similarity";
import { occurrence, semantic } from "./strategyFields";
import { proposalFamily } from "../research/handoff";
import { runSourceKey } from "../ai/sourceAccess";
import { ConvexError, v, type Infer } from "convex/values";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { requestFields, planFields, itemFields } from "./fields";
import { sha256 } from "../lib/crypto";
import {
  draftIdeaVersion,
  draftResearchProof,
  projectDraft,
} from "../research/contentProof";
import { currentIdeaSource } from "../content/ideas";
import { currentEvidence, projectEvidence } from "../research/evidence";
import {
  validateContent,
  checkApproval,
  immutableMedia,
  occupied,
  scheduleBlocksSlot,
} from "../editorial";
import { addCivilDays, resolveLocalTime } from "../../src/lib/time";
const vRequest = v.object(requestFields);
const planDoc = v.object({
  _id: v.id("contentPlans"),
  _creationTime: v.number(),
  ...planFields,
});
const itemDoc = v.object({
  _id: v.id("contentPlanItems"),
  _creationTime: v.number(),
  ...itemFields,
});
function days(a: {
  desiredCount: number;
  start: string;
  end: string;
  clock: string;
  timezone: string;
  topics: string;
}) {
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(Date.parse(`${s}T12:00Z`)) &&
    new Date(`${s}T12:00Z`).toISOString().slice(0, 10) === s;
  if (
    !Number.isSafeInteger(a.desiredCount) ||
    a.desiredCount < 1 ||
    a.desiredCount > 7 ||
    !valid(a.start) ||
    !valid(a.end) ||
    a.start > a.end ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.clock) ||
    a.topics.length > 200
  )
    throw new ConvexError("INVALID_PLAN_REQUEST");
  const count =
    (Date.parse(`${a.end}T12:00Z`) - Date.parse(`${a.start}T12:00Z`)) /
      86400000 +
    1;
  if (count > 93) throw new ConvexError("INVALID_PLAN_PERIOD");
  try {
    const zone = new Intl.DateTimeFormat("en", {
      timeZone: a.timezone,
    }).resolvedOptions().timeZone;
    if (/^[+-]/.test(zone)) throw new Error("Fixed offset");
  } catch {
    throw new ConvexError("INVALID_TIMEZONE");
  }
  return Array.from(
    { length: count },
    (_, i) => `${addCivilDays(a.start, i)}T${a.clock}`,
  );
}
async function candidate(
  ctx: QueryCtx,
  draft: Doc<"drafts">,
  accountId: Id<"socialAccounts">,
  readBudget?: { remaining: number },
  checkUnplanned = true,
) {
  const ver = draft.currentVersionId
    ? await ctx.db.get(draft.currentVersionId)
    : null;
  if (
    !ver ||
    ver.workspaceId !== draft.workspaceId ||
    ver.draftId !== draft._id ||
    ver.content.accountId !== accountId ||
    ver.sourceUnavailable
  )
    throw new ConvexError("ACCOUNT_OR_VERSION_MISMATCH");
  if (checkUnplanned) {
    if (readBudget && readBudget.remaining <= 0)
      throw new ConvexError("SLOT_SCAN_LIMIT");
    const limit = Math.min(100, readBudget?.remaining ?? 100);
    const history = await ctx.db
      .query("schedules")
      .withIndex("by_draftId", (q) => q.eq("draftId", draft._id))
      .take(limit + 1);
    if (history.length > limit) throw new ConvexError("SLOT_SCAN_LIMIT");
    if (readBudget) readBudget.remaining -= history.length;
    const attemptsBudget = { remaining: 100 };
    for (const s of history)
      if (
        s.state !== "cancelled" ||
        (await scheduleBlocksSlot(ctx, s, attemptsBudget, readBudget))
      )
        throw new ConvexError("ALREADY_PLANNED");
  }
  await validateContent(ctx, draft.workspaceId, ver.content, true);
  await immutableMedia(ctx, ver);
  const idea = await draftIdeaVersion(ctx, ver);
  if (!idea || idea.source.kind === "note")
    throw new ConvexError("UNVERIFIED_LINEAGE");
  const parent = await ctx.db.get(idea.ideaId);
  if (
    !parent ||
    parent.workspaceId !== draft.workspaceId ||
    parent.status === "archived" ||
    idea.sourceUnavailable
  )
    throw new ConvexError("IDEA_SOURCE_CHANGED");
  const sources = await currentIdeaSource(ctx, draft.workspaceId, idea.source);
  const proof = await draftResearchProof(ctx, ver);
  if (proof === null || !sources.length)
    throw new ConvexError("UNVERIFIED_LINEAGE");
  let validity: number | null = null;
  const researchFamilies: string[] = [],
    rootEvidenceIds: Id<"researchEvidence">[] = [];
  for (const source of sources)
    if ("kind" in source) {
      const { e } = await currentEvidence(
        ctx,
        draft.workspaceId,
        source.evidenceId,
        accountId,
      );
      const view = await projectEvidence(ctx, draft.workspaceId, e);
      const assessmentUntil = e.assessment?.validUntil;
      if (
        (e.inboxDisposition ?? "active") !== "active" ||
        !e.assessment?.substantiveSupportAttested ||
        !view.validityUntil ||
        !assessmentUntil ||
        !e.payload ||
        e.payload.annotation.freshness === "unknown"
      )
        throw new ConvexError("RESEARCH_REVIEW_REQUIRED");
      validity = Math.min(validity ?? assessmentUntil, assessmentUntil);
      const family = await proposalFamily(ctx, draft.workspaceId, e);
      researchFamilies.push(await sha256(family.family));
      rootEvidenceIds.push(family.root._id);
    }
  const previous = await ctx.db
    .query("contentPlanItems")
    .withIndex("by_versionId", (q) => q.eq("versionId", ver._id))
    .take(26);
  if (previous.length > 25 || (checkUnplanned && previous.length >= 25))
    throw new ConvexError("VERSION_PROPOSAL_LIMIT");
  // Original captured horizons survive source-grant renewal and later proposals.
  const until = Math.min(proof, ...previous.map((p) => p.proofUntil));
  validity = Math.min(
    validity ?? proof,
    ...previous.map((p) => p.validityUntil),
  );
  const families = [
    ...new Set([
      ...researchFamilies,
      ...sources.flatMap((s) =>
        "kind" in s
          ? []
          : [`work:${s.signalId ?? s.contextId}:${s.generation}`],
      ),
    ]),
  ];
  const kind = sources.every((s) => "kind" in s)
    ? "research"
    : sources.every((s) => !("kind" in s))
      ? "work"
      : "mixed";
  let pending = false;
  for (const p of previous) {
    if (
      p.status !== "proposed" ||
      p.sourceUnavailable ||
      p.at <= Date.now() ||
      Math.min(p.proofUntil, p.validityUntil) <= Date.now()
    )
      continue;
    const plan = await ctx.db.get(p.planId);
    if (plan?.series) {
      const series = await ctx.db.get(plan.series.seriesId);
      if (
        plan.sourceUnavailable ||
        !series?.enabled ||
        series.versionId !== plan.series.versionId ||
        series.generation !== plan.series.generation
      )
        continue;
    }
    pending = true;
    break;
  }
  return {
    draft,
    ver,
    idea,
    sources,
    families,
    rootEvidenceIds,
    kind,
    pending,
    proofUntil: until,
    validityUntil: validity,
  };
}
async function historyTopic(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  accountId: Id<"socialAccounts">,
  versionId: Id<"draftVersions">,
) {
  const ver = await ctx.db.get(versionId);
  requireReference(workspaceId, ver);
  if (!ver || !ver.content.pillar.trim())
    throw new Error("Unavailable history topic");
  const draft = await ctx.db.get(ver.draftId);
  requireReference(workspaceId, draft);
  const c = await candidate(
    ctx,
    { ...draft!, currentVersionId: versionId },
    accountId,
    undefined,
    false,
  );
  const projection = await projectDraft(ctx, ver);
  if (projection.sourceUnavailable)
    throw new Error("Unavailable history source");
  return {
    versionId,
    topic: projection.content.pillar,
    proofUntil: Math.min(c.proofUntil, c.validityUntil),
  };
}
export async function validateProposedItem(
  ctx: QueryCtx,
  item: Doc<"contentPlanItems">,
  readBudget?: { remaining: number },
  checkUnplanned = true,
  seriesProofs?: Map<Id<"contentPlans">, number | null>,
) {
  const plan = await ctx.db.get(item.planId);
  if (plan?.series) {
    const until = seriesProofs?.has(plan._id)
      ? seriesProofs.get(plan._id)!
      : await seriesPlanProof(ctx, plan);
    seriesProofs?.set(plan._id, until);
    if (item.sourceUnavailable || until === null || until <= item.at)
      throw new ConvexError("PLAN_SOURCE_EXPIRED");
  }
  const draft = requireReference(
    item.workspaceId,
    await ctx.db.get(item.draftId),
  ) as Doc<"drafts">;
  if (
    draft.currentVersionId !== item.versionId ||
    draft.revision !== item.draftRevision
  )
    throw new ConvexError("PLAN_VERSION_CHANGED");
  const c = await candidate(
    ctx,
    draft,
    item.accountId,
    readBudget,
    checkUnplanned,
  );
  if (
    c.ver._id !== item.versionId ||
    c.ver.number !== item.versionNumber ||
    c.idea._id !== item.ideaVersionId ||
    c.sources.length !== item.sources.length ||
    c.sources.some(
      (source, i) =>
        !item.sources[i] ||
        runSourceKey(source, false) !== runSourceKey(item.sources[i], false) ||
        (source.ideaVersionId ?? null) !==
          (item.sources[i].ideaVersionId ?? null),
    ) ||
    JSON.stringify(c.families) !== JSON.stringify(item.families) ||
    JSON.stringify(c.rootEvidenceIds) !== JSON.stringify(item.rootEvidenceIds)
  )
    throw new ConvexError("PLAN_SOURCE_CHANGED");
  if (
    item.proofUntil <= item.at ||
    item.validityUntil <= item.at ||
    c.proofUntil <= item.at ||
    c.validityUntil <= item.at
  )
    throw new ConvexError("PLAN_SOURCE_EXPIRED");
  if (!item.historyVersionIds || item.historyVersionIds.length > 10)
    throw new ConvexError("PLAN_CONTEXT_CHANGED");
  if (
    (item.historyVersionIds.length === 0 && item.contextProofUntil !== null) ||
    (item.historyVersionIds.length > 0 &&
      (!item.contextProofUntil || item.contextProofUntil <= item.at))
  )
    throw new ConvexError("PLAN_CONTEXT_CHANGED");
  for (const versionId of item.historyVersionIds) {
    const history = await historyTopic(
      ctx,
      item.workspaceId,
      item.accountId,
      versionId,
    );
    if (history.proofUntil <= item.at)
      throw new ConvexError("PLAN_CONTEXT_CHANGED");
  }
}
export const propose = workspaceMutation({
  args: { ...requestFields, commandKey: v.string() },
  returns: v.id("contentPlans"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    return proposeTransaction(ctx, ctx.workspace._id, ctx.user._id, a);
  },
});
export type SeriesPins = {
  series: Infer<typeof occurrence>;
  semantic: Infer<typeof semantic>;
  frame: Awaited<ReturnType<typeof preparedFrame>>;
  candidateVersionIds: Id<"draftVersions">[];
  previousVersionIds: Id<"draftVersions">[];
  slots: string[];
};
export async function proposeTransaction(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  actorId: Id<"users">,
  a: Infer<typeof vRequest> & { commandKey: string },
  pins?: SeriesPins,
) {
  const slots = pins?.slots ?? days(a);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(a.commandKey))
    throw new ConvexError("INVALID_PLAN_COMMAND");
  requireReference(workspaceId, await ctx.db.get(a.accountId));
  const preference = await ctx.db.get(a.preferenceId);
  if (
    !preference ||
    preference.workspaceId !== workspaceId ||
    preference.userId !== actorId
  )
    throw new ConvexError("REFERENCE_ACCESS_DENIED");
  const { commandKey, ...request } = a;
  const fingerprint = await sha256(
    JSON.stringify(pins ? [request, pins.series] : request),
  );
  const existing = await ctx.db
    .query("contentPlans")
    .withIndex("by_workspaceId_and_actorId_and_commandKey", (q) =>
      q
        .eq("workspaceId", workspaceId)
        .eq("actorId", actorId)
        .eq("commandKey", commandKey),
    )
    .unique();
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      throw new ConvexError("PLAN_OPERATION_CONFLICT");
    return existing._id;
  }
  // ponytail: finite selection uses 25 drafts and 10 recent terms; broader history needs a separate bounded design.
  const readBudget = { remaining: 256 };
  const recent = await ctx.db
    .query("schedules")
    .withIndex("by_workspaceId_and_accountId_and_at", (q) =>
      q.eq("workspaceId", workspaceId).eq("accountId", a.accountId),
    )
    .order("desc")
    .take(11);
  readBudget.remaining -= recent.length;
  const previousTopics: Awaited<ReturnType<typeof historyTopic>>[] = [];
  const historyContext = {
    scanned: Math.min(10, recent.length),
    available: 0,
    unavailable: 0,
    partial: recent.length > 10,
  };
  for (const row of recent.slice(0, 10))
    try {
      if (
        ![
          "scheduled",
          "publishing",
          "partially_published",
          "reconciliation_required",
          "published",
        ].includes(row.state) &&
        !row.externalPosts?.length &&
        !row.publishedCount
      )
        throw new Error("No known scheduled content");
      const previous = await historyTopic(
        ctx,
        workspaceId,
        a.accountId,
        row.versionId,
      );
      if (previous.proofUntil <= Date.now())
        throw new Error("Expired history source");
      previousTopics.push(previous);
      historyContext.available++;
    } catch {
      historyContext.unavailable++;
    }
  const shortages = new Map<string, number>();
  const skip = (code: string) =>
    shortages.set(code, (shortages.get(code) ?? 0) + 1);
  const rows = pins
    ? await Promise.all(
        pins.candidateVersionIds.map(async (id) => {
          const version = await ctx.db.get(id);
          requireReference(workspaceId, version);
          const draft = await ctx.db.get(version!.draftId);
          requireReference(workspaceId, draft);
          if (draft!.currentVersionId !== id)
            throw new ConvexError("PLAN_VERSION_CHANGED");
          return draft!;
        }),
      )
    : await ctx.db
        .query("drafts")
        .withIndex("by_workspaceId_and_updatedAt", (q) =>
          q.eq("workspaceId", workspaceId),
        )
        .order("desc")
        .take(26);
  const candidates: Awaited<ReturnType<typeof candidate>>[] = [];
  for (const draft of rows.slice(0, 25))
    try {
      const c = await candidate(ctx, draft, a.accountId, readBudget);
      if (c.pending) {
        skip("ALREADY_PROPOSED");
        continue;
      }
      if (a.mode !== "mixed" && c.kind !== a.mode) {
        skip("SOURCE_MIX_MISMATCH");
        continue;
      }
      if (
        pins &&
        (pins.previousVersionIds.includes(c.ver._id) ||
          pins.frame.native.rows
            .filter(
              (p) =>
                p.row.sourcePin.kind === "history" ||
                (p.row.sourcePin.kind === "draft" &&
                  pins.previousVersionIds.includes(
                    p.row.sourcePin.draftVersionId,
                  )),
            )
            .some(
              (p) =>
                cosine(
                  pins.frame.native.rows.find(
                    (p) =>
                      p.row.sourcePin.kind === "draft" &&
                      p.row.sourcePin.draftVersionId === c.ver._id,
                  )!.row.vector,
                  p.row.vector,
                ) >= pins.semantic.threshold,
            ))
      ) {
        skip("SEMANTIC_REPEAT");
        continue;
      }
      if (!pins && a.topics && c.ver.content.pillar !== a.topics) {
        skip("TOPIC_MISMATCH");
        continue;
      }
      candidates.push(c);
    } catch (e) {
      if (e instanceof ConvexError && e.data === "SLOT_SCAN_LIMIT") throw e;
      skip(e instanceof ConvexError ? String(e.data) : "SOURCE_UNAVAILABLE");
    }
  const selected: {
    c: (typeof candidates)[number];
    at: number;
    localTime: string;
    history: typeof previousTopics;
  }[] = [];
  const topics = new Set<string>(),
    families = new Set<string>();
  for (const localTime of slots) {
    let matches: string[];
    try {
      matches = resolveLocalTime(localTime, a.timezone);
    } catch {
      throw new ConvexError("INVALID_TIMEZONE");
    }
    if (matches.length !== 1) {
      skip(matches.length ? "AMBIGUOUS_LOCAL_TIME" : "NONEXISTENT_LOCAL_TIME");
      continue;
    }
    const at = Date.parse(matches[0]);
    if (at <= Date.now()) {
      skip("SLOT_IN_PAST");
      continue;
    }
    if (!candidates.length) {
      skip("NO_SUITABLE_MATERIAL");
      continue;
    }
    if (
      await occupied(ctx, workspaceId, a.accountId, at, undefined, readBudget)
    ) {
      skip("SLOT_OCCUPIED");
      continue;
    }
    const eligible = candidates.filter((c) => {
      if (
        c.proofUntil <= at ||
        c.validityUntil <= at ||
        (pins && pins.series.sourceUntil <= at)
      )
        return false;
      if (pins) {
        const vector = pins.frame.native.rows.find(
          (p) =>
            p.row.sourcePin.kind === "draft" &&
            p.row.sourcePin.draftVersionId === c.ver._id,
        )!.row.vector;
        if (
          selected.some(
            (p) =>
              cosine(
                vector,
                pins.frame.native.rows.find(
                  (v) =>
                    v.row.sourcePin.kind === "draft" &&
                    v.row.sourcePin.draftVersionId === p.c.ver._id,
                )!.row.vector,
              ) >= pins.semantic.threshold,
          )
        ) {
          skip("SEMANTIC_REPEAT");
          return false;
        }
      }
      return true;
    });
    if (!eligible.length) {
      skip(
        candidates.length
          ? "SOURCE_VALIDITY_BEFORE_SLOT"
          : "NO_SUITABLE_MATERIAL",
      );
      continue;
    }
    const history = previousTopics.filter((p) => p.proofUntil > at);
    const slotTopics = new Set([...topics, ...history.map((p) => p.topic)]);
    eligible.sort(
      (a, b) =>
        Number(slotTopics.has(a.ver.content.pillar)) -
          Number(slotTopics.has(b.ver.content.pillar)) ||
        a.families.filter((x) => families.has(x)).length -
          b.families.filter((x) => families.has(x)).length,
    );
    const c = eligible[0];
    selected.push({ c, at, localTime, history });
    topics.add(c.ver.content.pillar);
    c.families.forEach((x) => families.add(x));
    candidates.splice(candidates.indexOf(c), 1);
    if (selected.length === a.desiredCount) break;
  }
  const planId = await ctx.db.insert("contentPlans", {
    workspaceId: workspaceId,
    actorId: actorId,
    commandKey,
    fingerprint,
    createdAt: Date.now(),
    ...request,
    preferences: {
      timezone: preference.timezone,
      language: preference.language,
      audience: preference.audience,
      tone: preference.tone,
      topics: preference.topics,
    },
    historyContext,
    selectedCount: selected.length,
    candidateCount: Math.min(25, rows.length),
    coveragePartial: rows.length > 25,
    ...(pins
      ? {
          series: pins.series,
          semantic: pins.semantic,
          sourceUnavailable: false,
        }
      : {}),
    shortages: [...shortages].map(([code, count]) => ({ code, count })),
  });
  if (pins)
    for (const p of pins.frame.native.rows)
      await ctx.db.insert("semanticPlanBindings", {
        workspaceId,
        accountId: a.accountId,
        planId,
        vectorId: p.row._id,
        fingerprint: await vectorFingerprint(p.row),
        attemptId: p.row.attemptId,
        receiptFingerprint: p.receiptFingerprint,
        materialFingerprint: p.row.materialFingerprint,
        sourcePin: p.row.sourcePin,
        sourceUntil: Math.min(p.until, pins.series.sourceUntil),
        sourceUnavailable: false,
      });
  for (const { c, at, localTime, history } of selected)
    await ctx.db.insert("contentPlanItems", {
      workspaceId: workspaceId,
      planId,
      accountId: a.accountId,
      draftId: c.draft._id,
      versionId: c.ver._id,
      versionNumber: c.ver.number,
      draftRevision: c.draft.revision,
      ideaVersionId: c.idea._id,
      sources: c.sources,
      families: c.families,
      rootEvidenceIds: c.rootEvidenceIds,
      at,
      timezone: a.timezone,
      localTime,
      proofUntil: Math.min(c.proofUntil, pins?.series.sourceUntil ?? Infinity),
      validityUntil: Math.min(
        c.validityUntil,
        pins?.series.sourceUntil ?? Infinity,
      ),
      historyVersionIds: history.map((p) => p.versionId),
      contextProofUntil: history.length
        ? Math.min(...history.map((p) => p.proofUntil))
        : null,
      reason: `Geprüfter ${c.kind === "work" ? "Arbeits" : c.kind === "research" ? "Research" : "gemischter"} Entwurf; Themenvielfalt gegenüber höchstens 10 aktuell lesbaren früheren Terminen und Quellenvielfalt im Plan bevorzugt; erstes freies Tagesfenster.`,
      status: "proposed",
    });
  return planId;
}

export const context = workspaceQuery({
  args: {},
  returns: v.union(
    v.object({ preferenceId: v.id("preferences"), timezone: v.string() }),
    v.null(),
  ),
  handler: async (ctx) => {
    const p = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
      )
      .unique();
    return p ? { preferenceId: p._id, timezone: p.timezone } : null;
  },
});
export const list = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.array(planDoc),
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const plans = await ctx.db
      .query("contentPlans")
      .withIndex("by_workspaceId_and_accountId_and_createdAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .order("desc")
      .take(25);
    return plans.map((p) => (p.series ? redactPlan(p) : p));
  },
});
function redactPlan(plan: Doc<"contentPlans">) {
  return {
    ...plan,
    semantic: undefined,
    sourceUnavailable: true,
    fingerprint: "",
    topics: "",
    preferences: {
      timezone: plan.preferences.timezone,
      language: "",
      audience: "",
      tone: "",
      topics: "",
    },
  };
}
export async function projectPlan(
  ctx: QueryCtx,
  plan: Doc<"contentPlans">,
  items: Doc<"contentPlanItems">[],
) {
  if (!plan.series) return plan;
  try {
    const until = await seriesPlanProof(ctx, plan);
    if (until! <= Date.now() || items.some((item) => item.at >= until!))
      throw new ConvexError("SERIES_SOURCE_UNAVAILABLE");
    return {
      ...plan,
      series: {
        ...plan.series,
        sourceUntil: Math.min(plan.series.sourceUntil, until!),
      },
      semantic: plan.semantic
        ? {
            ...plan.semantic,
            sourceUntil: Math.min(plan.semantic.sourceUntil, until!),
          }
        : undefined,
    };
  } catch (e) {
    sourceLoss(e);
    return redactPlan(plan);
  }
}
export const get = workspaceQuery({
  args: { planId: v.id("contentPlans") },
  returns: v.object({
    plan: planDoc,
    items: v.array(
      v.object({
        item: itemDoc,
        title: v.string(),
        text: v.array(v.string()),
        state: v.string(),
        displayUntil: v.number(),
        approvalId: v.union(v.id("approvals"), v.null()),
        approvalsLimited: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, a) => {
    const plan = await ctx.db.get(a.planId);
    requireReference(ctx.workspace._id, plan);
    const items = await ctx.db
      .query("contentPlanItems")
      .withIndex("by_planId", (q) => q.eq("planId", a.planId))
      .take(8);
    if (items.length > 7) throw new ConvexError("PLAN_ITEM_LIMIT");
    const projectedPlan = await projectPlan(ctx, plan!, items);
    const projections = [];
    for (const item of items) {
      const approvals = await ctx.db
        .query("approvals")
        .withIndex("by_versionId_and_accountId", (q) =>
          q.eq("versionId", item.versionId).eq("accountId", item.accountId),
        )
        .order("desc")
        .take(101);
      let approvalId: Id<"approvals"> | null = null,
        approvalUntil: number | null = null;
      if (["Owner", "Admin"].includes(ctx.membership.role))
        try {
          const ver = requireReference(
            ctx.workspace._id,
            await ctx.db.get(item.versionId),
          ) as Doc<"draftVersions">;
          const pin = await currentReview(ctx, ver);
          const usable = approvals
            .slice(0, 100)
            .find(
              (a) =>
                a.actorId === ctx.user._id &&
                a.revokedAt === null &&
                (a.purpose ?? "publishing") === "publishing" &&
                (sameReview(a.reviewPin, pin) ||
                  (!a.reviewPin && pin.decisionIds.length === 0)) &&
                (a.reviewPin?.sourceUntil == null ||
                  a.reviewPin.sourceUntil > Date.now()),
            );
          if (usable) {
            await checkApproval(
              ctx,
              ctx.workspace._id,
              item.versionId,
              item.accountId,
              usable._id,
            );
            approvalId = usable._id;
            approvalUntil = Math.min(
              pin.sourceUntil ?? Infinity,
              usable.reviewPin?.sourceUntil ?? Infinity,
            );
          }
        } catch (error) {
          if (
            !isReviewLoss(error) &&
            !(
              error instanceof ConvexError &&
              [
                "APPROVAL_REQUIRED",
                "APPROVER_AUTHORITY_CHANGED",
                "ACCOUNT_REAUTH_OR_CAPABILITY_REQUIRED",
                "CAPABILITY_VALIDATION_FAILED",
                "MEDIA_NOT_READY",
                "MEDIA_SOURCE_CHANGED",
                "MEDIA_SNAPSHOT_CHANGED",
              ].includes(String(error.data))
            )
          )
            sourceLoss(error);
        }
      let state: string = item.status,
        title = "",
        text: string[] = [];
      let displayUntil = Math.min(
        item.proofUntil,
        item.validityUntil,
        item.at,
        item.contextProofUntil ?? Infinity,
        approvalUntil ?? Infinity,
      );
      try {
        if (projectedPlan.sourceUnavailable || item.sourceUnavailable)
          throw new ConvexError("SERIES_SOURCE_UNAVAILABLE");
        if (projectedPlan.series && projectedPlan.series.sourceUntil <= item.at)
          throw new ConvexError("SERIES_SOURCE_UNAVAILABLE");
        if (projectedPlan.series)
          displayUntil = Math.min(
            displayUntil,
            projectedPlan.series.sourceUntil,
          );
        const d = await ctx.db.get(item.draftId);
        requireReference(ctx.workspace._id, d);
        if (
          d!.currentVersionId !== item.versionId ||
          d!.revision !== item.draftRevision
        )
          state = "version_changed";
        const c = await candidate(
          ctx,
          { ...d!, currentVersionId: item.versionId },
          item.accountId,
          undefined,
          false,
        );
        displayUntil = Math.min(displayUntil, c.proofUntil, c.validityUntil);
        if (
          Math.min(c.proofUntil, c.validityUntil) <= item.at &&
          displayUntil > Date.now()
        )
          throw new Error(
            "Current source proof does not cover the intended slot",
          );
        let contextValid = true;
        try {
          if (!item.historyVersionIds || item.historyVersionIds.length > 10)
            throw new Error("Unknown history context");
          if (
            (item.historyVersionIds.length === 0 &&
              item.contextProofUntil !== null) ||
            (item.historyVersionIds.length > 0 &&
              (!item.contextProofUntil || item.contextProofUntil <= item.at))
          )
            contextValid = false;
          for (const versionId of item.historyVersionIds) {
            const previous = await historyTopic(
              ctx,
              ctx.workspace._id,
              item.accountId,
              versionId,
            );
            displayUntil = Math.min(displayUntil, previous.proofUntil);
            if (previous.proofUntil <= item.at) contextValid = false;
          }
          if (
            item.contextProofUntil !== null &&
            (item.contextProofUntil === undefined ||
              item.contextProofUntil <= Date.now())
          )
            contextValid = false;
        } catch {
          contextValid = false;
        }
        if (displayUntil <= Date.now()) state = "expired";
        if (!contextValid) state = "context_changed";
        if (displayUntil > Date.now() && contextValid) {
          const projection = await projectDraft(ctx, c.ver);
          title = projection.content.title;
          text = projection.content.text;
        }
        if (
          item.status === "proposed" &&
          (await occupied(ctx, ctx.workspace._id, item.accountId, item.at))
        )
          state = "conflict";
      } catch (e) {
        state =
          e instanceof ConvexError && e.data === "PLAN_VERSION_CHANGED"
            ? "version_changed"
            : e instanceof ConvexError && e.data === "PLAN_CONTEXT_CHANGED"
              ? "context_changed"
              : "source_unavailable";
      }
      if (item.status === "rejected") state = "rejected";
      if (item.status === "accepted") state = "accepted";
      const unavailable =
        !!projectedPlan.sourceUnavailable ||
        !!item.sourceUnavailable ||
        (plan!.series && !title);
      projections.push({
        item: unavailable
          ? {
              ...item,
              sources: [],
              families: [],
              rootEvidenceIds: [],
              reason: "",
              historyVersionIds: [],
            }
          : item,
        title,
        text,
        state,
        displayUntil: unavailable
          ? Math.min(displayUntil, Date.now())
          : displayUntil,
        approvalId: unavailable ? null : approvalId,
        approvalsLimited: approvals.length > 100,
      });
    }
    return { plan: projectedPlan, items: projections };
  },
});
export const reject = workspaceMutation({
  args: { itemId: v.id("contentPlanItems") },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const item = await ctx.db.get(a.itemId);
    requireReference(ctx.workspace._id, item);
    if (item!.status === "accepted")
      throw new ConvexError("PLAN_ALREADY_ACCEPTED");
    if (item!.status === "rejected") return null;
    await ctx.db.patch(a.itemId, { status: "rejected" });
    return null;
  },
});
