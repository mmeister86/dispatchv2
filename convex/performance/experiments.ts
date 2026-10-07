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
import { preflight } from "../publishing";
import {
  policy as metricPolicy,
  fingerprint as metricFingerprint,
  grants as metricGrants,
  credential as metricCredential,
  admin as metricAdmin,
} from "./capabilities";
import { retainedSnapshotHorizon } from "./snapshots";
import { normalize } from "./normalize";
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
    (error instanceof Error &&
      error.message === "OWN_METRICS_SOURCE_UNAVAILABLE") ||
    (error instanceof ConvexError &&
      [
        "EXPERIMENT_SOURCE_UNAVAILABLE",
        "OWN_METRICS_CONFIGURATION_REQUIRED",
        "OWN_METRICS_BUDGET_CONFIGURATION_REQUIRED",
        "APPROVAL_REQUIRED",
        "APPROVER_AUTHORITY_CHANGED",
        "SCHEDULER_AUTHORITY_CHANGED",
        "ACCOUNT_CONNECTION_CHANGED",
        "SCHEDULE_ABORT_REQUESTED",
        "X_SCHEDULE_CHANGED",
        "MEDIA_SNAPSHOT_CHANGED",
      ].includes(String(error.data)))
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
  rights: new Map<string, number>(),
  publications: new Map<
    Id<"editorialExperimentAssignments">,
    Awaited<ReturnType<typeof publicationObservation>>
  >(),
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
  if (row.publication) {
    const e = await ctx.db.get(row.experimentId);
    if (!e?.spec?.publication) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    const s = await publicationSchedule(ctx, row);
    for (const ref of ver!.content.media) {
      const asset = await ctx.db.get(ref.assetId);
      // Terminal local source removal differs from transient transport/readiness failures.
      if (!asset || asset.state === "deleting" || asset.state === "deleted")
        fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    }
    await preflight(ctx, s);
    horizons.push(await publicationRights(ctx, e.spec, row, p));
    const pins = await ctx.db
      .query("editorialExperimentBindings")
      .withIndex("by_assignmentId", (q) => q.eq("assignmentId", row._id))
      .take(146);
    if (pins.length > 145) fail("EXPERIMENT_RESOURCE_CEILING");
    for (const b of pins.filter((b) => b.snapshotId)) {
      const snap = await ctx.db.get(b.snapshotId!);
      if (
        b.sourceUnavailable ||
        b.workspaceId !== row.workspaceId ||
        b.accountId !== row.accountId ||
        !snap ||
        snap.workspaceId !== row.workspaceId ||
        snap.accountId !== row.accountId ||
        snap.scheduleId !== s._id ||
        snap.versionId !== row.versionId ||
        snap.windowHours !== e.spec.publication.windowHours ||
        snap.state === "removed" ||
        snap.expiresAt <= Date.now()
      )
        fail("EXPERIMENT_SOURCE_UNAVAILABLE");
      horizons.push(b.sourceUntil, snap.expiresAt);
    }
  }
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
      .take(146);
    if (
      bindings.length > 145 ||
      bindings.filter((b) => b.vectorId !== null).length !==
        plan.semantic!.vectorCount ||
      bindings.filter((b) => b.draftVersionId !== null).length !==
        item.historyVersionIds!.length ||
      item.historyVersionIds!.some(
        (id) => !bindings.some((b) => b.draftVersionId === id),
      )
    )
      fail("EXPERIMENT_RESOURCE_CEILING");
    for (const b of bindings.filter((b) => !b.snapshotId)) {
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
  if ((a.spec.outcome === "editorial-decision-v1") !== !a.spec.publication)
    fail("EXPERIMENT_INPUT_INVALID");
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
    (s.outcome === "editorial-decision-v1" &&
      new Set(a.units.map((u) => `${u.versionId}:${u.reviewerId}`)).size !==
        a.units.length)
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
      if (a.action.kind !== "withdraw") await authority(ctx, e);
      rows = await assignments(ctx, e._id);
      if (a.action.kind !== "withdraw")
        for (const row of rows)
          until = minimum(until, await assignmentProof(ctx, row, p));
      until = minimum(until, e.sourceUntil);
    }
    if (old) {
      if (a.action.kind === "withdraw") await authority(ctx, e!);
      if (old.sourceUnavailable || old.fingerprint !== fingerprint)
        fail("EXPERIMENT_COMMAND_CONFLICT");
      return {
        experimentId: old.experimentId,
        revision: old.revision,
        receiptId: old._id,
      };
    }
    if (a.action.kind === "declare" || a.action.kind === "declarePublication") {
      if (e || a.experimentId || a.expectedRevision !== 0)
        fail("EXPERIMENT_REVISION_CONFLICT");
      const declaration = a.action;
      const nativeUnits = [];
      if (declaration.kind === "declarePublication") {
        if (
          declaration.spec.outcome !== "publication-count-v1" ||
          !declaration.spec.publication ||
          new Set(declaration.units.map((u) => u.scheduleId)).size !==
            declaration.units.length
        )
          fail("EXPERIMENT_INPUT_INVALID");
        await publicationRights(
          ctx,
          declaration.spec,
          { workspaceId: ctx.workspace._id, accountId: a.accountId },
          p,
        );
        for (const u of declaration.units) {
          const s = requireReference(
            ctx.workspace._id,
            await ctx.db.get(u.scheduleId),
          ) as Doc<"schedules">;
          if (
            s.accountId !== a.accountId ||
            s.purpose === "first_write_verification"
          )
            fail("REFERENCE_ACCESS_DENIED");
          await publicationAdmission(ctx, s);
          nativeUnits.push({
            versionId: s.versionId,
            reviewerId: ctx.user._id,
            planItemId: u.planItemId,
            arm: u.arm,
            publication: {
              scheduleId: s._id,
              approvalId: s.approvalId,
              generation: s.generation,
              connectionSequence: s.accountConnectionSequence ?? 0,
              providerIdentity: (await ctx.db.get(a.accountId))!
                .providerIdentity,
              admittedAt: Date.now(),
            },
          });
        }
      } else {
        if (
          declaration.spec.outcome !== "editorial-decision-v1" ||
          declaration.spec.publication
        )
          fail("EXPERIMENT_INPUT_INVALID");
        for (const u of declaration.units) {
          await priorDecision(ctx, u);
          nativeUnits.push({ ...u, publication: null });
        }
      }
      validate({ kind: "declare", spec: declaration.spec, units: nativeUnits });
      const planned = [];
      for (const u of nativeUnits) {
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
          publication: u.publication,
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
        if (u.publication)
          horizon = minimum(
            horizon,
            await publicationRights(ctx, declaration.spec, row, p),
          );
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
        for (const row of rows) {
          if (row.publication)
            await publicationAdmission(
              ctx,
              await publicationSchedule(ctx, row),
            );
          else await priorDecision(ctx, row);
        }
        await ctx.db.patch(e._id, {
          state: "running",
          startSequence: sequence,
          startedAt: Date.now(),
          sourceUntil: until,
          revision: e.revision + 1,
        });
      } else if (a.action.kind === "withdraw") {
        if (e.spec?.outcome !== "publication-count-v1")
          fail("EXPERIMENT_INPUT_INVALID");
        for (const row of rows) await scrub(ctx, row);
        await ctx.db.patch(e._id, { revision: e.revision + 1 });
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
  if (row.publication) {
    const o = await publicationObservation(ctx, e, row, p);
    p.publications.set(row._id, o);
    return {
      outcome: o.outcome === "withdrawn" ? "withdrawn" : "no-feedback",
      editCount: 0,
      editExtent: null,
      missingEdits: 0,
      until: o.until,
    };
  }
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
      publication:
        e.spec?.outcome === "publication-count-v1" && readable
          ? await publicationResults(ctx, e, rows, p)
          : null,
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
    let publicationConfiguration = null;
    try {
      const policy = await metricPolicy(ctx, {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
      });
      await publicationMetricRights(ctx, {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
      });
      publicationConfiguration = {
        policyId: policy._id,
        policyFingerprint: await metricFingerprint(policy),
        version: policy.version,
        dialect: policy.dialect,
        windows: policy.windows ?? [24, 48],
        fields: policy.fields,
        expiresAt: policy.expiresAt,
      };
    } catch (error) {
      loss(error);
    }
    const scheduleRows = await ctx.db
      .query("schedules")
      .withIndex("by_workspaceId_and_accountId_and_state", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("state", "scheduled"),
      )
      .take(33);
    const schedules = [];
    for (const s of scheduleRows.slice(0, 32)) {
      const ver = await ctx.db.get(s.versionId);
      if (s.purpose !== "first_write_verification" && ver)
        schedules.push({
          scheduleId: s._id,
          versionId: s.versionId,
          at: s.at,
          positions: ver.content.text.length,
        });
    }
    return {
      publicationConfiguration,
      schedules,
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
      publication: null,
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
    .take(146);
  if (bindings.length > 145) fail("EXPERIMENT_RESOURCE_CEILING");
  for (const b of bindings)
    await ctx.db.patch(b._id, {
      sourceUnavailable: true,
      fingerprint: null,
      snapshotId: null,
    });
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

async function publicationMetricRights(
  ctx: Ctx,
  scope: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
) {
  const p = await metricPolicy(ctx, scope),
    ids = await metricGrants(ctx, p, false),
    cred = await metricCredential(ctx, scope, p);
  const control = await ctx.db
    .query("performanceControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", scope.workspaceId).eq("accountId", scope.accountId),
    )
    .unique();
  if (
    !control ||
    control.deleted ||
    control.connectionSequence !== p.connectionSequence
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  await metricAdmin(ctx, scope.workspaceId, control.actorId);
  return {
    p,
    until: Math.min(
      p.expiresAt,
      cred.expiresAt - 15000,
      ...(await Promise.all(ids.map((id) => ctx.db.get(id)))).map(
        (b) => b!.expiresAt,
      ),
    ),
  };
}
async function publicationRights(
  ctx: Ctx,
  spec: NonNullable<Experiment["spec"]>,
  scope: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
  cache?: { rights: Map<string, number> },
) {
  const key = JSON.stringify([
    scope.workspaceId,
    scope.accountId,
    spec.publication,
  ]);
  if (cache?.rights.has(key)) return cache.rights.get(key)!;
  const local = spec.publication;
  if (
    !local ||
    [local.rightsEvidence, local.explanation].some(
      (s) => !s.trim() || s.length > 2000,
    ) ||
    !Number.isSafeInteger(local.expiresAt) ||
    local.expiresAt <= Date.now()
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const { p, until } = await publicationMetricRights(ctx, scope),
    original = await ctx.db.get(local.policyId);
  if (
    !original ||
    original.workspaceId !== scope.workspaceId ||
    original.accountId !== scope.accountId ||
    (await metricFingerprint(original)) !== local.policyFingerprint ||
    !original.fields.includes(local.metric) ||
    !(original.windows ?? [24, 48]).includes(local.windowHours) ||
    !p.fields.includes(local.metric) ||
    !(p.windows ?? [24, 48]).includes(local.windowHours) ||
    original.providerIdentity !== p.providerIdentity
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  await metricAdmin(ctx, scope.workspaceId, original.approvedBy);
  const horizon = Math.min(until, original.expiresAt, local.expiresAt);
  cache?.rights.set(key, horizon);
  return horizon;
}
async function publicationHistory(ctx: Ctx, scheduleId: Id<"schedules">) {
  const posts = await ctx.db
    .query("xPostAttempts")
    .withIndex("by_scheduleId_and_generation_and_position", (q) =>
      q.eq("scheduleId", scheduleId),
    )
    .take(101);
  const media = await ctx.db
    .query("xMediaCheckpoints")
    .withIndex("by_scheduleId_and_generation_and_mediaPosition", (q) =>
      q.eq("scheduleId", scheduleId),
    )
    .take(33);
  if (posts.length > 100 || media.length > 32)
    fail("EXPERIMENT_RESOURCE_CEILING");
  return { posts, media };
}
async function publicationAdmission(ctx: Ctx, s: Doc<"schedules">) {
  const ver = await preflight(ctx, s);
  if (
    s.state !== "scheduled" ||
    s.publishedCount !== 0 ||
    s.externalPosts?.length ||
    s.purpose === "first_write_verification"
  )
    fail("EXPERIMENT_PUBLICATION_ALREADY_STARTED");
  const { posts, media } = await publicationHistory(ctx, s._id);
  // Conservative: no preparing checkpoint is admitted, even before its first provider request.
  if (posts.length || media.length)
    fail("EXPERIMENT_PUBLICATION_ALREADY_STARTED");
  if (!ver.content.text.length || ver.content.text.length > 10)
    fail("EXPERIMENT_RESOURCE_CEILING");
}
async function publicationSchedule(ctx: Ctx, row: Assignment) {
  const pin = row.publication,
    s = pin ? await ctx.db.get(pin.scheduleId) : null,
    account = await ctx.db.get(row.accountId);
  if (
    !s ||
    !pin ||
    !account ||
    s.workspaceId !== row.workspaceId ||
    s.accountId !== row.accountId ||
    s.versionId !== row.versionId ||
    s.draftId !== row.draftId ||
    s.approvalId !== pin.approvalId ||
    s.generation !== pin.generation ||
    (s.accountConnectionSequence ?? 0) !== pin.connectionSequence ||
    (account.xEvidence?.connectionSequence ?? 0) !== pin.connectionSequence ||
    account.providerIdentity !== pin.providerIdentity ||
    account.provider !== "X" ||
    account.connection !== "connected"
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  return s!;
}
async function publicationSnapshot(
  ctx: Ctx,
  e: Experiment,
  row: Assignment,
  s: Doc<"schedules">,
  post: Doc<"xPostAttempts">,
  snap: Doc<"performanceSnapshots">,
) {
  const local = e.spec!.publication!,
    original = await ctx.db.get(local.policyId),
    t = snap.attemptId ? await ctx.db.get(snap.attemptId) : null;
  const horizon = await retainedSnapshotHorizon(ctx, snap);
  if (
    !t ||
    t.owner !== "own-metrics" ||
    t.runId !== undefined ||
    t.researchOrderId !== undefined ||
    t.logicalIntent !== undefined ||
    t.provider !== "x" ||
    t.purpose !== "own-post-descriptive-editorial-v1" ||
    t.state !== "settled" ||
    t.settledAt === null ||
    t.heldMicros !== 0 ||
    t.policyId !== local.policyId ||
    t.policyFingerprint !== local.policyFingerprint ||
    t.policyVersion !== original?.version ||
    snap.definitionVersion !== original?.version ||
    snap.dialect !== original?.dialect ||
    snap.confirmedAt !== post.confirmedAt ||
    snap.position !== post.position ||
    snap.scheduleId !== s._id ||
    snap.versionId !== row.versionId ||
    snap.windowHours !== local.windowHours ||
    snap.requestedAt === null ||
    snap.observedAt === null ||
    snap.providerCreatedAt === null
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  await metricAdmin(ctx, row.workspaceId, original!.approvedBy);
  if (
    t.budgetIds.length !== 3 ||
    new Set(t.budgetIds).size !== 3 ||
    t.unitMicros !== original!.unitMicros ||
    t.unitMicros !== t.reservedMicros ||
    t.estimatedMicros !== t.unitMicros ||
    t.currency !== original!.currency ||
    t.unit !== "single-post-request" ||
    t.credentialGeneration === undefined
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  for (const [i, id] of t.budgetIds.entries()) {
    const b = await ctx.db.get(id);
    if (
      !b ||
      b.key !==
        [
          "metrics:x",
          `metrics:workspace:${row.workspaceId}`,
          `metrics:account:${row.accountId}`,
        ][i] ||
      b.scope !== (["provider", "workspace", "account"] as const)[i] ||
      b.currency !== t.currency ||
      (i === 0 && (b.workspaceId !== undefined || b.accountId !== undefined)) ||
      (i === 1 &&
        (b.workspaceId !== row.workspaceId || b.accountId !== undefined)) ||
      (i === 2 &&
        (b.workspaceId !== row.workspaceId || b.accountId !== row.accountId))
    )
      fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  }
  if (
    t.receiptFingerprint !==
    (await sha256(
      JSON.stringify({
        knownCharge: true,
        fields: snap.fields,
        providerCreatedAt: snap.providerCreatedAt,
        reason: snap.reason,
      }),
    ))
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const dates = [
    post.requestStartedAt,
    post.confirmedAt,
    snap.providerCreatedAt,
    snap.requestedAt,
    t.sentAt,
    t.settledAt,
    snap.observedAt,
  ];
  if (
    dates.some(
      (n) => n === undefined || !Number.isSafeInteger(n) || n! > Date.now(),
    ) ||
    post.requestStartedAt! > post.confirmedAt! ||
    post.confirmedAt! > t.sentAt ||
    t.sentAt > snap.requestedAt ||
    snap.requestedAt > t.settledAt ||
    t.settledAt > snap.observedAt
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const b = await ctx.db
    .query("editorialExperimentBindings")
    .withIndex("by_assignmentId_and_snapshotId", (q) =>
      q.eq("assignmentId", row._id).eq("snapshotId", snap._id),
    )
    .unique();
  if (!b)
    return {
      reason: "measurement-binding-pending",
      value: null,
      until: Math.min(horizon, row.sourceUntil ?? Infinity),
      key: null,
    };
  if (
    b.sourceUnavailable ||
    b.workspaceId !== row.workspaceId ||
    b.accountId !== row.accountId ||
    b.vectorId !== null ||
    b.draftVersionId !== null
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  const until = Math.min(
    horizon,
    b.sourceUntil ?? Infinity,
    snap.dueAt + original!.retentionMs,
    row.sourceUntil ?? Infinity,
  );
  if (until <= Date.now()) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  if (
    snap.late ||
    Math.abs(
      snap.observedAt - snap.providerCreatedAt - local.windowHours * 3600000,
    ) > 60000
  )
    return { reason: "outside-age-window", value: null, until, key: null };
  const fields = snap.fields.filter((f) => f.name === local.metric),
    descriptor = normalize(
      { data: { id: post.externalId, author_id: post.providerIdentity } },
      post.externalId!,
      post.providerIdentity,
      [local.metric],
      original!.dialect,
    ).fields[0];
  if (
    fields.length !== 1 ||
    fields[0].rawField !== descriptor.rawField ||
    fields[0].definition !== descriptor.definition
  )
    return {
      reason: "incompatible-metric-definition",
      value: null,
      until,
      key: null,
    };
  const f = fields[0];
  if (
    f.status !== "measured" ||
    f.value === null ||
    !Number.isSafeInteger(f.value) ||
    f.value < 0
  )
    return {
      reason: f.status === "measured" ? "missing" : f.status,
      value: null,
      until,
      key: null,
    };
  const ver = (await ctx.db.get(row.versionId))!,
    kinds = [];
  for (const m of ver.content.media) {
    const asset = await ctx.db.get(m.assetId);
    if (!asset || asset.workspaceId !== row.workspaceId || !asset.type)
      fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    kinds.push(asset!.type);
  }
  kinds.sort();
  const format = ver.content.text.length === 1 ? "post" : "thread",
    media = kinds.length ? kinds.join("+") : "none";
  const key = JSON.stringify([
    row.accountId,
    format,
    media,
    local.metric,
    f.rawField,
    f.definition,
    original!.version,
    original!.dialect,
    local.windowHours,
  ]);
  return {
    reason: null,
    value: f.value,
    until,
    key,
    format,
    media,
    rawField: f.rawField,
    definition: f.definition,
    definitionVersion: original!.version,
    dialect: original!.dialect,
    windowHours: local.windowHours,
    metric: local.metric,
  };
}
async function publicationObservation(
  ctx: Ctx,
  e: Experiment,
  row: Assignment,
  cache?: { rights: Map<string, number> },
) {
  const s = await publicationSchedule(ctx, row),
    { posts, media } = await publicationHistory(ctx, s._id);
  const until = minimum(
    row.sourceUntil,
    await publicationRights(ctx, e.spec!, row, cache),
  );
  const sent = posts.filter((p) => p.requestStartedAt !== undefined),
    firstSendAt = sent.length
      ? Math.min(...sent.map((p) => p.requestStartedAt!))
      : null;
  const base = {
    assignmentId: row._id,
    scheduleId: s._id,
    arm: row.arm,
    value: null as number | null,
    firstSendAt,
    until,
    key: null as string | null,
    reason: null as string | null,
    outcome: "missing",
    format: null as string | null,
    media: null as string | null,
    metric: null as string | null,
    rawField: null as string | null,
    definition: null as string | null,
    definitionVersion: null as string | null,
    dialect: null as string | null,
    windowHours: null as number | null,
  };
  if (
    posts.some(
      (p) =>
        p.workspaceId !== row.workspaceId ||
        p.accountId !== row.accountId ||
        p.versionId !== row.versionId ||
        p.generation !== row.publication!.generation ||
        p.providerIdentity !== row.publication!.providerIdentity ||
        p.connectionSequence !== row.publication!.connectionSequence,
    )
  )
    fail("EXPERIMENT_SOURCE_UNAVAILABLE");
  if (
    firstSendAt !== null &&
    (e.startedAt === null ||
      firstSendAt <
        Math.max(e.spec!.startsAt, e.startedAt, row.publication!.admittedAt) ||
      firstSendAt >= Math.min(e.endsAt, e.stoppedAt ?? Infinity))
  )
    return {
      ...base,
      outcome: "excluded",
      reason: "send-outside-observation-window",
    };
  if (firstSendAt === null)
    return {
      ...base,
      outcome: media.length ? "unknown" : "missing",
      reason: media.length ? "media-only-no-confirmed-publication" : "not-sent",
    };
  if (posts.some((p) => p.stage === "unknown" || p.stage === "sending"))
    return {
      ...base,
      outcome: "unknown",
      reason: "publication-outcome-unknown",
    };
  const ver = (await ctx.db.get(row.versionId))!,
    total = ver.content.text.length,
    confirmed = s.externalPosts ?? [];
  if (
    confirmed.length !== total ||
    new Set(confirmed.map((p) => p.position)).size !== total ||
    Array.from({ length: total }, (_, i) => i).some(
      (i) => !confirmed.some((p) => p.position === i),
    )
  )
    return {
      ...base,
      outcome: confirmed.length
        ? "partial"
        : posts.some((p) => p.stage === "rejected")
          ? "excluded"
          : "missing",
      reason: confirmed.length
        ? "incomplete-thread"
        : posts.some((p) => p.stage === "rejected")
          ? "publication-rejected"
          : "not-confirmed",
    };
  const values = [];
  for (const external of confirmed) {
    const post = posts.find((p) => p._id === external.attemptId);
    if (
      !post ||
      post.stage !== "confirmed" ||
      post.externalId !== external.externalId ||
      post.position !== external.position ||
      post.confirmedAt !== external.confirmedAt ||
      post.requestStartedAt === undefined
    )
      fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    const snap = await ctx.db
      .query("performanceSnapshots")
      .withIndex("by_postAttemptId_and_windowHours", (q) =>
        q
          .eq("postAttemptId", post._id)
          .eq("windowHours", e.spec!.publication!.windowHours),
      )
      .unique();
    if (!snap || ["queued", "reading", "blocked"].includes(snap.state))
      return {
        ...base,
        outcome: "confirmed",
        reason: !snap
          ? "no-measurement"
          : (snap.reason ?? "measurement-pending"),
      };
    if (snap.state === "removed") fail("EXPERIMENT_SOURCE_UNAVAILABLE");
    values.push(await publicationSnapshot(ctx, e, row, s, post, snap));
  }
  if (values.some((v) => v.value === null))
    return {
      ...base,
      outcome: "confirmed",
      reason: values.find((v) => v.value === null)!.reason,
      until: minimum(until, ...values.map((v) => v.until)),
    };
  if (new Set(values.map((v) => v.key)).size !== 1)
    return {
      ...base,
      outcome: "confirmed",
      reason: "incompatible-thread-definitions",
    };
  const value = values.reduce((sum, v) => sum + v.value!, 0);
  if (!Number.isSafeInteger(value))
    return { ...base, outcome: "confirmed", reason: "unsafe-count-sum" };
  return {
    ...base,
    ...values[0],
    value,
    firstSendAt,
    until: minimum(until, ...values.map((v) => v.until)),
    outcome: "measured",
  };
}
async function publicationResults(
  ctx: Ctx,
  e: Experiment,
  rows: Assignment[],
  p: ReturnType<typeof proofContext>,
) {
  const empty = () => ({
    assigned: 0,
    confirmed: 0,
    measured: 0,
    partial: 0,
    unknown: 0,
    excluded: 0,
    withdrawn: 0,
    missing: 0,
  });
  const counts = empty(),
    arms = { A: empty(), B: empty() },
    units = [];
  const cohorts = new Map<
    string,
    {
      key: string;
      format: string;
      media: string;
      metric: string;
      rawField: string;
      definition: string;
      definitionVersion: string;
      dialect: string;
      windowHours: number;
      values: { A: number[]; B: number[] };
      dates: { A: number[]; B: number[] };
    }
  >();
  for (const row of rows) {
    const o = p.publications.get(row._id)!;
    counts.assigned++;
    if (row.arm) arms[row.arm].assigned++;
    const bucket = o.outcome as Exclude<keyof typeof counts, "assigned">;
    counts[bucket]++;
    if (row.arm) arms[row.arm][bucket]++;
    if (o.outcome === "measured") {
      counts.confirmed++;
      if (row.arm) arms[row.arm].confirmed++;
    }
    units.push({
      assignmentId: o.assignmentId,
      scheduleId: o.scheduleId,
      arm: o.arm,
      outcome: o.outcome,
      reason: o.reason,
      value: o.value,
      firstSendAt: o.firstSendAt,
      until: o.until,
    });
    if (o.key && o.outcome === "measured" && row.arm) {
      let c = cohorts.get(o.key);
      if (!c) {
        c = {
          key: o.key,
          format: o.format!,
          media: o.media!,
          metric: o.metric!,
          rawField: o.rawField!,
          definition: o.definition!,
          definitionVersion: o.definitionVersion!,
          dialect: o.dialect!,
          windowHours: o.windowHours!,
          values: { A: [], B: [] },
          dates: { A: [], B: [] },
        };
        cohorts.set(o.key, c);
      }
      c.values[row.arm].push(o.value!);
      c.dates[row.arm].push(o.firstSendAt!);
    }
  }
  const measured = (values: number[], dates: number[]) => {
    const total = values.reduce((s, n) => s + n, 0),
      sum = values.length && Number.isSafeInteger(total) ? total : null;
    return {
      n: values.length,
      sum,
      mean: sum === null ? null : sum / values.length,
      from: dates.length ? Math.min(...dates) : null,
      to: dates.length ? Math.max(...dates) : null,
    };
  };
  return {
    counts,
    arms,
    units,
    cohorts: [...cohorts.values()].map(({ values, dates, ...c }) => {
      const A = measured(values.A, dates.A),
        B = measured(values.B, dates.B);
      return {
        ...c,
        A,
        B,
        difference: A.mean === null || B.mean === null ? null : B.mean - A.mean,
      };
    }),
  };
}

export const bindSnapshots = internalMutation({
  args: {
    scheduleId: v.id("schedules"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("editorialExperimentAssignments")
      .withIndex("by_publication_scheduleId_and_sourceUnavailable", (q) =>
        q
          .eq("publication.scheduleId", a.scheduleId)
          .eq("sourceUnavailable", false),
      )
      .paginate({ cursor: a.cursor, numItems: 1 });
    for (const row of page.page) {
      try {
        const e = await ctx.db.get(row.experimentId);
        if (!e) fail("EXPERIMENT_SOURCE_UNAVAILABLE");
        await authority(ctx, e!);
        const proof = proofContext(),
          assignmentUntil = await assignmentProof(ctx, row, proof),
          observed = await publicationObservation(ctx, e!, row, proof);
        if (
          ["excluded", "unknown", "partial", "missing"].includes(
            observed.outcome,
          )
        )
          continue;
        const { posts } = await publicationHistory(ctx, a.scheduleId);
        for (const post of posts.filter((p) => p.stage === "confirmed")) {
          if (
            post.generation !== row.publication!.generation ||
            post.versionId !== row.versionId ||
            post.accountId !== row.accountId ||
            post.workspaceId !== row.workspaceId
          )
            fail("EXPERIMENT_SOURCE_UNAVAILABLE");
          const snap = await ctx.db
            .query("performanceSnapshots")
            .withIndex("by_postAttemptId_and_windowHours", (q) =>
              q
                .eq("postAttemptId", post._id)
                .eq("windowHours", e!.spec!.publication!.windowHours),
            )
            .unique();
          if (!snap || snap.state === "removed" || snap.expiresAt <= Date.now())
            continue;
          const old = await ctx.db
            .query("editorialExperimentBindings")
            .withIndex("by_assignmentId_and_snapshotId", (q) =>
              q.eq("assignmentId", row._id).eq("snapshotId", snap._id),
            )
            .unique();
          const sourceUntil = minimum(
            assignmentUntil,
            observed.until,
            row.sourceUntil,
            e!.sourceUntil,
            snap.expiresAt,
            old?.sourceUntil ?? null,
          );
          if (!old)
            await ctx.db.insert("editorialExperimentBindings", {
              workspaceId: row.workspaceId,
              accountId: row.accountId,
              assignmentId: row._id,
              vectorId: null,
              draftVersionId: null,
              fingerprint: null,
              snapshotId: snap._id,
              sourceUntil,
              sourceUnavailable: false,
            });
          else if (sourceUntil !== old.sourceUntil)
            await ctx.db.patch(old._id, { sourceUntil });
        }
      } catch (error) {
        loss(error);
        await scrub(ctx, row);
      }
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.bindSnapshots,
        { ...a, cursor: page.continueCursor },
      );
    return null;
  },
});
export const purgeSnapshot = internalMutation({
  args: { snapshotId: v.id("performanceSnapshots") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const rows = await ctx.db
      .query("editorialExperimentBindings")
      .withIndex("by_snapshotId_and_sourceUnavailable", (q) =>
        q.eq("snapshotId", a.snapshotId).eq("sourceUnavailable", false),
      )
      .take(1);
    for (const b of rows) {
      const row = await ctx.db.get(b.assignmentId);
      if (row) await scrub(ctx, row);
      else
        await ctx.db.patch(b._id, {
          snapshotId: null,
          fingerprint: null,
          sourceUnavailable: true,
        });
    }
    if (rows.length)
      await ctx.scheduler.runAfter(
        0,
        internal.performance.experiments.purgeSnapshot,
        a,
      );
    return null;
  },
});
