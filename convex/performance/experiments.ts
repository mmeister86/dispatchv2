import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import {
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import {
  workspaceQuery,
  workspaceMutation,
  requireWorkspace,
  requireRole,
  requireReference,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
import { materialWalk } from "../research/pipelineAccess";
import { draftIdeaVersion, draftResearchProof } from "../research/contentProof";
import { evidence } from "../content/feedback";
import { scopedStyleProof } from "../ai/styleProfiles";
import {
  seriesPlanProof,
  seriesVersionProof,
  sourceLoss as seriesLoss,
} from "../planning/strategy";
import { vectorFingerprint } from "../content/similarity";
import { action, result, detail, catalog } from "./experimentFields";
type Ctx = QueryCtx | MutationCtx;
type Experiment = Doc<"editorialExperiments">;
type Assignment = Doc<"editorialExperimentAssignments">;
type Action = Infer<typeof action>;
function fail(code: string): never {
  throw new ConvexError(code);
}
const minimum = (...values: (number | null)[]) => {
  const n = Math.min(...values.map((v) => v ?? Infinity));
  return Number.isFinite(n) ? n : null;
};
function loss(error: unknown) {
  if (
    error instanceof ConvexError &&
    error.data === "EXPERIMENT_SOURCE_UNAVAILABLE"
  )
    return;
  if (
    error instanceof ConvexError &&
    [
      "STYLE_ANCESTRY_LIMIT",
      "RESEARCH_PROOF_ANCESTRY_LIMIT",
      "EXPERIMENT_RESOURCE_CEILING",
    ].includes(String(error.data))
  )
    throw error;
  seriesLoss(error);
}
async function identity(user: Doc<"users">, member: Doc<"memberships">) {
  return sha256(
    JSON.stringify([
      user._id,
      user._creationTime,
      user.authId,
      member._id,
      member._creationTime,
    ]),
  );
}
async function actor(
  ctx: Ctx,
  ws: Id<"workspaces">,
  userId: Id<"users">,
  admin = false,
) {
  const user = await ctx.db.get(userId);
  if (!user) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const scope = await requireWorkspace(ctx, ws, user!);
  requireRole(
    scope.membership,
    admin ? ["Owner", "Admin"] : ["Owner", "Admin", "Editor"],
  );
  return { ...scope, fingerprint: await identity(user!, scope.membership) };
}
async function authority(ctx: Ctx, e: Experiment) {
  requireReference(e.workspaceId, await ctx.db.get(e.accountId));
  const a = await actor(ctx, e.workspaceId, e.actorId, true);
  if (
    e.sourceUnavailable ||
    !e.spec ||
    a.membership._id !== e.membershipId ||
    a.fingerprint !== e.actorFingerprint ||
    (e.sourceUntil !== null && e.sourceUntil <= Date.now())
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
}
const proofContext = () => ({
  walk: materialWalk(),
  plans: new Map<string, number | null>(),
  series: new Map<
    Id<"planningSeriesVersions">,
    Awaited<ReturnType<typeof seriesVersionProof>>
  >(),
  fingerprints: new Map<Id<"contentEmbeddings">, string>(),
});
async function assignmentProof(ctx: Ctx, row: Assignment, p = proofContext()) {
  if (row.sourceUnavailable || !row.arm) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const reviewer = await actor(ctx, row.workspaceId, row.reviewerId);
  if (
    reviewer.membership._id !== row.reviewerMembershipId ||
    reviewer.fingerprint !== row.reviewerFingerprint
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  requireReference(row.workspaceId, await ctx.db.get(row.accountId));
  const ver = await ctx.db.get(row.versionId),
    draft = await ctx.db.get(row.draftId);
  if (
    !ver ||
    !draft ||
    ver.workspaceId !== row.workspaceId ||
    draft.workspaceId !== row.workspaceId ||
    ver.draftId !== row.draftId ||
    ver.content.accountId !== row.accountId
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const horizons = [
    row.sourceUntil,
    await draftResearchProof(ctx, ver!, p.walk),
  ];
  if (row.style)
    horizons.push(
      (await scopedStyleProof(ctx, row, row.style, false, p.walk)).sourceUntil,
    );
  if (row.planItemId) {
    const item = await ctx.db.get(row.planItemId),
      plan = item ? await ctx.db.get(item.planId) : null;
    if (
      !item ||
      !plan ||
      item.workspaceId !== row.workspaceId ||
      item.accountId !== row.accountId ||
      item.versionId !== row.versionId ||
      item.versionNumber !== ver!.number ||
      !plan.series ||
      !plan.semantic ||
      !item.historyVersionIds ||
      item.historyVersionIds.length > 10 ||
      item.draftId !== row.draftId ||
      item.sourceUnavailable ||
      plan.sourceUnavailable ||
      plan.workspaceId !== row.workspaceId ||
      plan.accountId !== row.accountId ||
      (plan.series?.versionId ?? null) !== row.seriesVersionId
    )
      fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    if (!p.plans.has(plan._id))
      p.plans.set(
        plan._id,
        await seriesPlanProof(ctx, plan, false, p.walk, p.series),
      );
    horizons.push(
      item.proofUntil,
      item.validityUntil,
      item.contextProofUntil ?? null,
      p.plans.get(plan._id)!,
    );
    const bindings = await ctx.db
      .query("editorialExperimentBindings")
      .withIndex("by_assignmentId", (q) => q.eq("assignmentId", row._id))
      .take(136);
    if (
      bindings.length > 135 ||
      bindings.filter((b) => b.vectorId !== null).length !==
        plan.semantic!.vectorCount ||
      bindings.filter((b) => b.draftVersionId !== null).length !==
        item.historyVersionIds!.length ||
      item.historyVersionIds!.some(
        (id) => !bindings.some((b) => b.draftVersionId === id),
      )
    )
      fail("EXPERIMENT_RESOURCE_CEILING");
    for (const b of bindings) {
      if (
        b.sourceUnavailable ||
        b.workspaceId !== row.workspaceId ||
        b.accountId !== row.accountId
      )
        fail("EXPERIMENT_SOURCE_UNAVAILABLE");
      if (b.vectorId) {
        const vector = p.series
          .get(row.seriesVersionId!)!
          .frame.native.rows.find((entry) => entry.row._id === b.vectorId);
        if (!vector || b.draftVersionId !== null)
          fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        if (!p.fingerprints.has(vector.row._id))
          p.fingerprints.set(
            vector.row._id,
            await vectorFingerprint(vector.row),
          );
        if (b.fingerprint !== p.fingerprints.get(vector.row._id))
          fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        horizons.push(b.sourceUntil, vector.until);
      } else {
        const history = b.draftVersionId
          ? await ctx.db.get(b.draftVersionId)
          : null;
        if (
          !history ||
          history.workspaceId !== row.workspaceId ||
          history.content.accountId !== row.accountId ||
          b.fingerprint !== null
        )
          fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        const owner = await ctx.db.get(history.draftId);
        if (!owner || owner.workspaceId !== row.workspaceId)
          fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        horizons.push(
          b.sourceUntil,
          await draftResearchProof(ctx, history, p.walk),
        );
      }
    }
  }
  const until = minimum(...horizons);
  if (until !== null && until <= Date.now())
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  return until;
}
async function assignments(ctx: Ctx, id: Id<"editorialExperiments">) {
  const rows = await ctx.db
    .query("editorialExperimentAssignments")
    .withIndex("by_experimentId", (q) => q.eq("experimentId", id))
    .take(33);
  if (rows.length > 32) fail("EXPERIMENT_RESOURCE_CEILING");
  return rows;
}
async function priorDecision(
  ctx: Ctx,
  row: Pick<Assignment, "versionId" | "reviewerId">,
) {
  for (const kind of ["accept", "reject"] as const)
    if (
      await ctx.db
        .query("contentFeedback")
        .withIndex("by_versionId_and_actorId_and_kind_and_sequence", (q) =>
          q
            .eq("versionId", row.versionId)
            .eq("actorId", row.reviewerId)
            .eq("kind", kind),
        )
        .first()
    )
      fail("EXPERIMENT_PREDECIDED_UNIT");
}
function validate(a: Extract<Action, { kind: "declare" }>) {
  const s = a.spec;
  if (
    [s.hypothesis, s.a, s.b, s.stopCondition, s.context, s.frequency].some(
      (x) => !x.trim() || x.length > 1000,
    ) ||
    s.a.trim() === s.b.trim() ||
    !Number.isSafeInteger(s.startsAt) ||
    !Number.isSafeInteger(s.endsAt) ||
    s.startsAt < Date.now() ||
    s.endsAt <= s.startsAt ||
    s.endsAt - s.startsAt > 28 * 86400000 ||
    !Number.isSafeInteger(s.sampleCap) ||
    s.sampleCap < 2 ||
    s.sampleCap > 32 ||
    a.units.length < 2 ||
    a.units.length > s.sampleCap ||
    !a.units.some((u) => u.arm === "A") ||
    !a.units.some((u) => u.arm === "B") ||
    new Set(a.units.map((u) => `${u.versionId}:${u.reviewerId}`)).size !==
      a.units.length
  )
    fail("EXPERIMENT_INPUT_INVALID");
}
export const change = workspaceMutation({
  args: {
    accountId: v.id("socialAccounts"),
    experimentId: v.optional(v.id("editorialExperiments")),
    expectedRevision: v.number(),
    commandKey: v.string(),
    action,
  },
  returns: result,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    if (
      !/^[A-Za-z0-9_-]{1,100}$/.test(a.commandKey) ||
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision < 0
    )
      fail("EXPERIMENT_INPUT_INVALID");
    const fingerprint = await sha256(
      JSON.stringify([
        ctx.workspace._id,
        a.accountId,
        ctx.user._id,
        a.experimentId ?? null,
        a.expectedRevision,
        a.action,
      ]),
    );
    const old = await ctx.db
      .query("editorialExperimentCommands")
      .withIndex(
        "by_workspaceId_and_accountId_and_actorId_and_commandKey",
        (q) =>
          q
            .eq("workspaceId", ctx.workspace._id)
            .eq("accountId", a.accountId)
            .eq("actorId", ctx.user._id)
            .eq("commandKey", a.commandKey),
      )
      .unique();
    let e =
      a.experimentId || old
        ? await ctx.db.get(a.experimentId ?? old!.experimentId)
        : null;
    if (old && !e) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    if (
      e &&
      (e.workspaceId !== ctx.workspace._id || e.accountId !== a.accountId)
    )
      fail("REFERENCE_ACCESS_DENIED");
    const p = proofContext();
    let rows: Assignment[] = [],
      until: number | null = null;
    if (e) {
      await authority(ctx, e);
      rows = await assignments(ctx, e._id);
      for (const row of rows)
        until = minimum(until, await assignmentProof(ctx, row, p));
      until = minimum(until, e.sourceUntil);
    }
    if (old) {
      if (old.sourceUnavailable || old.fingerprint !== fingerprint)
        fail("EXPERIMENT_COMMAND_CONFLICT");
      return {
        experimentId: old.experimentId,
        revision: old.revision,
        receiptId: old._id,
      };
    }
    if (a.action.kind === "declare") {
      if (e || a.experimentId || a.expectedRevision !== 0)
        fail("EXPERIMENT_REVISION_CONFLICT");
      validate(a.action);
      const planned = [];
      for (const u of a.action.units) {
        await priorDecision(ctx, u);
        const ver = requireReference(
          ctx.workspace._id,
          await ctx.db.get(u.versionId),
        ) as Doc<"draftVersions">;
        const reviewer = await actor(ctx, ctx.workspace._id, u.reviewerId);
        const idea = await draftIdeaVersion(ctx, ver),
          run = idea?.runId ? await ctx.db.get(idea.runId) : null;
        const item = u.planItemId ? await ctx.db.get(u.planItemId) : null,
          plan = item ? await ctx.db.get(item.planId) : null;
        if (
          u.planItemId &&
          (!item ||
            !plan ||
            item.versionId !== ver._id ||
            item.workspaceId !== ctx.workspace._id ||
            item.accountId !== a.accountId ||
            item.draftId !== ver.draftId ||
            item.versionNumber !== ver.number ||
            plan.workspaceId !== ctx.workspace._id ||
            plan.accountId !== a.accountId ||
            !plan.series ||
            !plan.semantic ||
            !item.historyVersionIds ||
            item.historyVersionIds.length > 10)
        )
          fail("REFERENCE_ACCESS_DENIED");
        if (
          run &&
          (run.workspaceId !== ctx.workspace._id ||
            run.accountId !== a.accountId)
        )
          fail("REFERENCE_ACCESS_DENIED");
        const row = {
          workspaceId: ctx.workspace._id,
          accountId: a.accountId,
          versionId: u.versionId,
          reviewerId: u.reviewerId,
          draftId: ver.draftId,
          reviewerMembershipId: reviewer.membership._id,
          reviewerFingerprint: reviewer.fingerprint,
          arm: u.arm,
          planItemId: u.planItemId,
          seriesVersionId: plan?.series?.versionId ?? null,
          style: plan?.semantic?.style ?? run?.styleContext ?? null,
          sourceUntil: null,
          sourceUnavailable: false,
        };
        // Proof before insertion; vector reverse bindings are captured below, after the exact native plan proof.
        const draft = await ctx.db.get(ver.draftId);
        if (
          !draft ||
          draft.workspaceId !== ctx.workspace._id ||
          ver.content.accountId !== a.accountId
        )
          fail("REFERENCE_ACCESS_DENIED");
        let horizon = await draftResearchProof(ctx, ver, p.walk);
        if (row.style)
          horizon = minimum(
            horizon,
            (await scopedStyleProof(ctx, row, row.style, false, p.walk))
              .sourceUntil,
          );
        let bindings: Doc<"semanticPlanBindings">[] = [];
        const historyBindings: {
          draftVersionId: Id<"draftVersions">;
          sourceUntil: number | null;
        }[] = [];
        if (plan && item) {
          if (!p.plans.has(plan._id))
            p.plans.set(
              plan._id,
              await seriesPlanProof(ctx, plan, false, p.walk, p.series),
            );
          horizon = minimum(
            horizon,
            item.proofUntil,
            item.validityUntil,
            item.contextProofUntil ?? null,
            p.plans.get(plan._id)!,
          );
          bindings = await ctx.db
            .query("semanticPlanBindings")
            .withIndex("by_planId", (q) => q.eq("planId", plan._id))
            .take(126);
          if (bindings.length > 125) fail("EXPERIMENT_RESOURCE_CEILING");
          for (const id of item.historyVersionIds!) {
            const history = await ctx.db.get(id);
            if (
              !history ||
              history.workspaceId !== ctx.workspace._id ||
              history.content.accountId !== a.accountId
            )
              fail("EXPERIMENT_SOURCE_UNAVAILABLE");
            const owner = await ctx.db.get(history.draftId);
            if (!owner || owner.workspaceId !== ctx.workspace._id)
              fail("EXPERIMENT_SOURCE_UNAVAILABLE");
            const sourceUntil = minimum(
              item.contextProofUntil ?? null,
              await draftResearchProof(ctx, history, p.walk),
            );
            horizon = minimum(horizon, sourceUntil);
            historyBindings.push({ draftVersionId: id, sourceUntil });
          }
          if (
            item.sourceUnavailable ||
            plan.sourceUnavailable ||
            (horizon !== null && horizon <= Date.now())
          )
            fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        }
        until = minimum(until, horizon);
        planned.push({
          row: { ...row, sourceUntil: horizon },
          bindings,
          historyBindings,
        });
      }
      const id = await ctx.db.insert("editorialExperiments", {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        actorId: ctx.user._id,
        membershipId: ctx.membership._id,
        actorFingerprint: await identity(ctx.user, ctx.membership),
        spec: a.action.spec,
        revision: 1,
        state: "planned",
        startSequence: null,
        stopSequence: null,
        startedAt: null,
        stoppedAt: null,
        endsAt: a.action.spec.endsAt,
        sourceUntil: until,
        sourceUnavailable: false,
        createdAt: Date.now(),
      });
      for (const { row, bindings, historyBindings } of planned) {
        const assignmentId = await ctx.db.insert(
          "editorialExperimentAssignments",
          { ...row, experimentId: id },
        );
        for (const b of bindings)
          await ctx.db.insert("editorialExperimentBindings", {
            workspaceId: row.workspaceId,
            accountId: row.accountId,
            assignmentId,
            vectorId: b.vectorId,
            draftVersionId: null,
            fingerprint: b.fingerprint,
            sourceUntil: b.sourceUntil,
            sourceUnavailable: false,
          });
        for (const b of historyBindings)
          await ctx.db.insert("editorialExperimentBindings", {
            workspaceId: row.workspaceId,
            accountId: row.accountId,
            assignmentId,
            vectorId: null,
            draftVersionId: b.draftVersionId,
            fingerprint: null,
            sourceUntil: b.sourceUntil,
            sourceUnavailable: false,
          });
      }
      e = (await ctx.db.get(id))!;
    } else {
      if (!e || a.expectedRevision !== e.revision)
        fail("EXPERIMENT_REVISION_CONFLICT");
      const sequence =
        (await ctx.db.get(ctx.workspace._id))!.feedbackSequence ?? 0;
      if (a.action.kind === "start") {
        if (e.state !== "planned" || Date.now() >= e.endsAt)
          fail("EXPERIMENT_TERMINAL");
        if (Date.now() < e.spec!.startsAt) fail("EXPERIMENT_START_NOT_DUE");
        for (const row of rows) await priorDecision(ctx, row);
        await ctx.db.patch(e._id, {
          state: "running",
          startSequence: sequence,
          startedAt: Date.now(),
          sourceUntil: until,
          revision: e.revision + 1,
        });
      } else {
        if (e.state === "stopped") fail("EXPERIMENT_TERMINAL");
        await ctx.db.patch(e._id, {
          state: "stopped",
          stopSequence: sequence,
          stoppedAt: Date.now(),
          sourceUntil: until,
          revision: e.revision + 1,
        });
      }
      e = (await ctx.db.get(e._id))!;
    }
    const receiptId = await ctx.db.insert("editorialExperimentCommands", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      experimentId: e!._id,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      revision: e!.revision,
      sourceUnavailable: false,
      createdAt: Date.now(),
    });
    return { experimentId: e!._id, revision: e!.revision, receiptId };
  },
});
async function observations(
  ctx: Ctx,
  e: Experiment,
  row: Assignment,
  p: ReturnType<typeof proofContext>,
) {
  const kinds = new Set<string>();
  let editCount = 0,
    editExtent: number | null = null,
    missingEdits = 0,
    until = row.sourceUntil;
  if (e.startSequence === null)
    return {
      outcome: "no-feedback",
      editCount,
      editExtent,
      missingEdits,
      until,
    };
  for (const kind of ["accept", "reject", "edit"] as const) {
    const events = await ctx.db
      .query("contentFeedback")
      .withIndex("by_versionId_and_actorId_and_kind_and_createdAt", (q) =>
        q
          .eq("versionId", row.versionId)
          .eq("actorId", row.reviewerId)
          .eq("kind", kind)
          .gte("createdAt", Math.max(e.spec!.startsAt, e.startedAt!))
          .lt("createdAt", e.endsAt),
      )
      // The index bounds time; the independent sequence range is applied before the cap.
      .filter((q) =>
        q.and(
          q.gt(q.field("sequence"), e.startSequence!),
          q.lte(q.field("sequence"), e.stopSequence ?? Number.MAX_SAFE_INTEGER),
        ),
      )
      .take(129);
    if (events.length > 128) fail("EXPERIMENT_RESOURCE_CEILING");
    const seen = new Set<string>();
    for (const event of events) {
      if (
        event.sequence === undefined ||
        (e.stopSequence !== null && event.sequence > e.stopSequence) ||
        event.createdAt < e.spec!.startsAt ||
        event.createdAt >= e.endsAt ||
        event.createdAt < e.startedAt!
      )
        continue;
      if (kind === "edit") {
        const edge = `${event.versionId}:${event.resultingVersionId}`;
        if (seen.has(edge)) continue;
        seen.add(edge);
      }
      try {
        const proof = await evidence(ctx, event, p.walk);
        until = minimum(until, proof.sourceUntil);
        if (kind === "edit") {
          editCount++;
          if (event.editExtent === null) missingEdits++;
          else editExtent = (editExtent ?? 0) + event.editExtent;
        } else kinds.add(kind);
      } catch (error) {
        loss(error);
        if (kind === "edit") missingEdits++;
        else
          return {
            outcome: "withdrawn",
            editCount: 0,
            editExtent: null,
            missingEdits: 0,
            until,
          };
      }
    }
  }
  return {
    outcome:
      kinds.size === 2
        ? "conflict"
        : kinds.has("accept")
          ? "accept"
          : kinds.has("reject")
            ? "reject"
            : "no-feedback",
    editCount,
    editExtent: missingEdits ? null : editExtent,
    missingEdits,
    until,
  };
}
export const get = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    experimentId: v.id("editorialExperiments"),
  },
  returns: detail,
  handler: async (ctx, a) => {
    const e = requireReference(
      ctx.workspace._id,
      await ctx.db.get(a.experimentId),
    ) as Experiment;
    if (e.accountId !== a.accountId) fail("REFERENCE_ACCESS_DENIED");
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const rows = await assignments(ctx, e._id),
      p = proofContext();
    let authorized = true,
      until = e.sourceUntil;
    try {
      await authority(ctx, e);
    } catch (error) {
      loss(error);
      authorized = false;
    }
    const units = [];
    const emptyCounts = () => ({
      enrolled: 0,
      decided: 0,
      accept: 0,
      reject: 0,
      conflict: 0,
      noFeedback: 0,
      withdrawn: 0,
      edited: 0,
      missingEdits: 0,
    });
    const counts = { ...emptyCounts(), enrolled: rows.length },
      arms = { A: emptyCounts(), B: emptyCounts() };
    for (const row of rows) {
      let out: Awaited<ReturnType<typeof observations>> = {
        outcome: "withdrawn",
        editCount: 0,
        editExtent: null,
        missingEdits: 0,
        until: row.sourceUntil,
      };
      if (authorized)
        try {
          const proof = await assignmentProof(ctx, row, p);
          out = await observations(ctx, e, row, p);
          out.until = minimum(proof, out.until);
          until = minimum(until, out.until);
        } catch (error) {
          loss(error);
        }
      if (out.outcome === "accept" || out.outcome === "reject") {
        counts[out.outcome]++;
        counts.decided++;
      } else if (out.outcome === "conflict") counts.conflict++;
      else if (out.outcome === "no-feedback") counts.noFeedback++;
      else counts.withdrawn++;
      if (out.editCount) counts.edited++;
      counts.missingEdits += out.missingEdits;
      if (row.arm && out.outcome !== "withdrawn") {
        const arm = arms[row.arm];
        arm.enrolled++;
        if (out.outcome === "accept" || out.outcome === "reject") {
          arm[out.outcome]++;
          arm.decided++;
        } else if (out.outcome === "conflict") arm.conflict++;
        else arm.noFeedback++;
        if (out.editCount) arm.edited++;
        arm.missingEdits += out.missingEdits;
      }
      units.push({
        assignmentId: row._id,
        versionId: row.versionId,
        reviewerId: row.reviewerId,
        arm: out.outcome === "withdrawn" ? null : row.arm,
        ...out,
      });
    }
    const readable = authorized && counts.withdrawn === 0;
    return {
      experimentId: e._id,
      revision: e.revision,
      state: !readable
        ? "withdrawn"
        : e.state === "stopped"
          ? "stopped"
          : Date.now() >= e.endsAt
            ? "ended"
            : e.state,
      spec: readable ? e.spec : null,
      sourceUntil: until,
      endsAt: e.endsAt,
      enrollmentCapped: readable && rows.length === e.spec!.sampleCap,
      units: readable
        ? units
        : units.map((unit) => ({
            ...unit,
            arm: null,
            outcome: "withdrawn",
            editCount: 0,
            editExtent: null,
            missingEdits: 0,
          })),
      counts: readable
        ? counts
        : { ...emptyCounts(), enrolled: rows.length, withdrawn: rows.length },
      arms: readable ? arms : { A: emptyCounts(), B: emptyCounts() },
    };
  },
});
export const list = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: catalog,
  handler: async (ctx, a) => {
    requireReference(ctx.workspace._id, await ctx.db.get(a.accountId));
    const rows = await ctx.db
      .query("editorialExperiments")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .order("desc")
      .take(32);
    const drafts = await ctx.db
      .query("drafts")
      .withIndex("by_workspaceId_and_updatedAt", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .order("desc")
      .take(33);
    const candidates = [];
    for (const draft of drafts.slice(0, 32))
      if (draft.currentVersionId) {
        const ver = await ctx.db.get(draft.currentVersionId);
        if (
          ver &&
          !ver.sourceUnavailable &&
          ver.content.accountId === a.accountId
        )
          candidates.push({
            versionId: ver._id,
            number: ver.number,
            draftId: draft._id,
          });
      }
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ctx.workspace._id),
      )
      .take(101);
    if (members.length > 100) fail("EXPERIMENT_RESOURCE_CEILING");
    return {
      experiments: rows.map((e) => ({
        experimentId: e._id,
        revision: e.revision,
        state: e.sourceUnavailable
          ? "withdrawn"
          : Date.now() >= e.endsAt
            ? "ended"
            : e.state,
      })),
      candidates,
      reviewers: members
        .filter((m) => ["Owner", "Admin", "Editor"].includes(m.role))
        .map((m) => ({ reviewerId: m.userId, role: m.role })),
    };
  },
});
async function scrub(ctx: MutationCtx, row: Assignment) {
  if (!row.sourceUnavailable)
    await ctx.db.patch(row._id, {
      sourceUnavailable: true,
      arm: null,
      style: null,
      planItemId: null,
      seriesVersionId: null,
      reviewerFingerprint: "",
    });
  const e = await ctx.db.get(row.experimentId);
  if (e && !e.sourceUnavailable) {
    await ctx.db.patch(e._id, {
      sourceUnavailable: true,
      spec: null,
      actorFingerprint: "",
    });
    await ctx.scheduler.runAfter(
      0,
      internal.performance.experiments.purgeExperiment,
      { experimentId: e._id, cursor: null },
    );
  }
  const bindings = await ctx.db
    .query("editorialExperimentBindings")
    .withIndex("by_assignmentId", (q) => q.eq("assignmentId", row._id))
    .take(136);
  if (bindings.length > 135) fail("EXPERIMENT_RESOURCE_CEILING");
  for (const b of bindings)
    await ctx.db.patch(b._id, { sourceUnavailable: true, fingerprint: null });
  await ctx.scheduler.runAfter(
    0,
    internal.performance.experiments.purgeCommands,
    { experimentId: row.experimentId, cursor: null },
  );
}
export const purgeCommands = internalMutation({
  args: {
    experimentId: v.id("editorialExperiments"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialExperimentCommands")
      .withIndex("by_experimentId", (q) => q.eq("experimentId", a.experimentId))
      .paginate({ cursor: a.cursor, numItems: 25 });
    for (const c of page.page)
      await ctx.db.patch(c._id, { fingerprint: null, sourceUnavailable: true });
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeCommands,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
export const purgeVersion = internalMutation({
  args: { versionId: v.id("draftVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_versionId_and_sourceUnavailable", (q) =>
        q.eq("versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(1);
    for (const row of rows) await scrub(ctx, row);
    const bindings = await ctx.db
      .query("editorialExperimentBindings")
      .withIndex("by_draftVersionId_and_sourceUnavailable", (q) =>
        q.eq("draftVersionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(1);
    for (const b of bindings) {
      const row = await ctx.db.get(b.assignmentId);
      if (row) await scrub(ctx, row);
      else
        await ctx.db.patch(b._id, {
          fingerprint: null,
          sourceUnavailable: true,
        });
    }
    if (rows.length || bindings.length)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeVersion,
        a,
      );
    return null;
  },
});
export const purgeFeedback = internalMutation({
  args: {
    versionId: v.id("draftVersions"),
    reviewerId: v.id("users"),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_versionId_and_reviewerId", (q) =>
        q.eq("versionId", a.versionId).eq("reviewerId", a.reviewerId),
      )
      .paginate({ cursor: a.cursor ?? null, numItems: 1 });
    for (const row of page.page)
      if (!row.sourceUnavailable) {
        try {
          const e = await ctx.db.get(row.experimentId);
          if (!e) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
          await authority(ctx, e!);
          const p = proofContext();
          await assignmentProof(ctx, row, p);
          if ((await observations(ctx, e!, row, p)).outcome === "withdrawn")
            fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        } catch (error) {
          loss(error);
          await scrub(ctx, row);
        }
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeFeedback,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
export const purgeStyle = internalMutation({
  args: { versionId: v.id("styleProfileVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_style_versionId_and_sourceUnavailable", (q) =>
        q.eq("style.versionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(1);
    for (const row of rows) await scrub(ctx, row);
    if (rows.length)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeStyle,
        a,
      );
    return null;
  },
});
export const purgeSeries = internalMutation({
  args: { versionId: v.id("planningSeriesVersions") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_seriesVersionId_and_sourceUnavailable", (q) =>
        q.eq("seriesVersionId", a.versionId).eq("sourceUnavailable", false),
      )
      .take(1);
    for (const row of rows) await scrub(ctx, row);
    if (rows.length)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeSeries,
        a,
      );
    return null;
  },
});
export const purgeVector = internalMutation({
  args: {
    vectorId: v.id("contentEmbeddings"),
    fingerprint: v.string(),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialExperimentBindings")
      .withIndex("by_vectorId_and_fingerprint", (q) =>
        q.eq("vectorId", a.vectorId).eq("fingerprint", a.fingerprint),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const b of page.page) {
      const row = await ctx.db.get(b.assignmentId);
      if (row) await scrub(ctx, row);
      else
        await ctx.db.patch(b._id, {
          fingerprint: null,
          sourceUnavailable: true,
        });
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeVector,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
export const sweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_sourceUnavailable", (q) =>
        q.eq("sourceUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page)
      try {
        const e = await ctx.db.get(row.experimentId);
        if (!e) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        await authority(ctx, e!);
        const p = proofContext(),
          original = await assignmentProof(ctx, row, p),
          observed = await observations(ctx, e!, row, p);
        const until = minimum(original, observed.until);
        if (observed.outcome === "withdrawn")
          fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        if (until !== row.sourceUntil)
          await ctx.db.patch(row._id, { sourceUntil: until });
      } catch (error) {
        loss(error);
        await scrub(ctx, row);
      }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.performance.experiments.sweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});

export const purgeExperiment = internalMutation({
  args: {
    experimentId: v.id("editorialExperiments"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_experimentId", (q) => q.eq("experimentId", a.experimentId))
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page) await scrub(ctx, row);
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeExperiment,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
