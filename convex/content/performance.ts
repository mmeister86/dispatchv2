import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import {
  workspaceQuery,
  workspaceMutation,
  requireReference,
  requireRole,
} from "../lib/authorization";
import { scope } from "../performance/fields";
import { admin } from "../performance/capabilities";
import { readOverview } from "../performance/snapshots";
import { sha256 } from "../lib/crypto";
import type { Doc, Id } from "../_generated/dataModel";
import {
  contentPerformancePolicyFields,
  performanceSignal,
} from "./performanceFields";
const fingerprint = (p: Doc<"performanceContentPolicies">) =>
  sha256(JSON.stringify(p));
async function policy(
  ctx: QueryCtx | MutationCtx,
  a: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
) {
  requireReference(a.workspaceId, await ctx.db.get(a.accountId));
  const p = await ctx.db
    .query("performanceContentPolicies")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", a.workspaceId).eq("accountId", a.accountId),
    )
    .order("desc")
    .first();
  if (
    !p ||
    p.expiresAt <= Date.now() ||
    !Number.isSafeInteger(p.expiresAt) ||
    !p.rightsEvidence.trim() ||
    p.rightsEvidence.length > 2000 ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(p.version)
  )
    throw new ConvexError("PERFORMANCE_CONTENT_CONFIGURATION_REQUIRED");
  await admin(ctx, a.workspaceId, p.approvedBy);
  return p;
}
export const configure = internalMutation({
  args: contentPerformancePolicyFields,
  returns: v.id("performanceContentPolicies"),
  handler: async (ctx, a) => {
    const old = await ctx.db
      .query("performanceContentPolicies")
      .withIndex("by_workspaceId_and_accountId_and_version", (q) =>
        q
          .eq("workspaceId", a.workspaceId)
          .eq("accountId", a.accountId)
          .eq("version", a.version),
      )
      .unique();
    if (old) {
      if (
        Object.keys(a).some(
          (k) =>
            JSON.stringify(a[k as keyof typeof a]) !==
            JSON.stringify(old[k as keyof typeof old]),
        )
      )
        throw new ConvexError("PERFORMANCE_CONTENT_POLICY_VERSION_CONFLICT");
      return old._id;
    }
    const id = await ctx.db.insert("performanceContentPolicies", a);
    await policy(ctx, a);
    return id;
  },
});
export const consent = workspaceMutation({
  args: {
    accountId: scope.accountId,
    enabled: v.boolean(),
    policyId: v.optional(v.id("performanceContentPolicies")),
    policyFingerprint: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    const control = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .unique();
    if (!control || control.deleted)
      throw new ConvexError("PERFORMANCE_CONTENT_METRICS_UNAVAILABLE");
    if (a.enabled) {
      const p = await policy(ctx, args);
      if (
        a.policyId !== p._id ||
        a.policyFingerprint !== (await fingerprint(p))
      )
        throw new ConvexError("PERFORMANCE_CONTENT_POLICY_CHANGED");
      await ctx.db.patch(control._id, {
        contentPolicyId: p._id,
        contentApprovedBy: ctx.user._id,
      });
    } else
      await ctx.db.patch(control._id, {
        contentPolicyId: undefined,
        contentApprovedBy: undefined,
      });
    return null;
  },
});
export const context = workspaceQuery({
  args: { accountId: scope.accountId },
  returns: v.object({
    enabled: v.boolean(),
    reason: v.union(v.string(), v.null()),
    configuration: v.union(
      v.object({
        id: v.id("performanceContentPolicies"),
        fingerprint: v.string(),
        expiresAt: v.number(),
        purpose: v.literal("own-performance-human-content-v1"),
      }),
      v.null(),
    ),
    entries: v.array(performanceSignal),
  }),
  handler: async (ctx, a) => {
    const args = { workspaceId: ctx.workspace._id, accountId: a.accountId };
    requireReference(args.workspaceId, await ctx.db.get(a.accountId));
    let p;
    try {
      p = await policy(ctx, args);
    } catch {
      return {
        enabled: false,
        reason: "PERFORMANCE_CONTENT_CONFIGURATION_REQUIRED",
        configuration: null,
        entries: [],
      };
    }
    const configuration = {
      id: p._id,
      fingerprint: await fingerprint(p),
      expiresAt: p.expiresAt,
      purpose: p.purpose,
    };
    const control = await ctx.db
      .query("performanceControls")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("accountId", args.accountId),
      )
      .unique();
    if (
      !control ||
      control.deleted ||
      control.contentPolicyId !== p._id ||
      !control.contentApprovedBy
    )
      return {
        enabled: false,
        reason: "PERFORMANCE_CONTENT_PAUSED",
        configuration,
        entries: [],
      };
    try {
      await admin(ctx, args.workspaceId, control.contentApprovedBy);
    } catch {
      return {
        enabled: false,
        reason: "PERFORMANCE_CONTENT_AUTHORITY_UNAVAILABLE",
        configuration,
        entries: [],
      };
    }
    const read = await readOverview(ctx, args);
    const entries = read.baseline.cohorts.flatMap((c) => {
      const metric = c.metrics.find((m) => m.name === "impressions");
      if (!metric?.n || metric.mean === null) return [];
      const ids = new Set(c.units.flatMap((u) => u.versionIds)),
        posts = read.posts.filter((x) => ids.has(x.versionId));
      const expiresAt = Math.min(
        p.expiresAt,
        c.until,
        ...posts.map((x) => x.knowledge?.assessment?.sourceUntil ?? Infinity),
      );
      if (expiresAt <= Date.now()) return [];
      return [
        {
          kind: "performance_signal" as const,
          asOf: read.baseline.asOf,
          cohort: c.key,
          definitionVersion: c.definitionVersion,
          expiresAt,
          snapshotIds: c.units.flatMap((u) => u.snapshotIds),
          versionIds: [...ids] as Id<"draftVersions">[],
          knowledgeIds: [
            ...new Set(
              posts.flatMap((x) => (x.knowledge ? [x.knowledge.id] : [])),
            ),
          ],
          assessmentIds: [
            ...new Set(
              posts.flatMap((x) =>
                x.knowledge?.assessment ? [x.knowledge.assessment._id] : [],
              ),
            ),
          ],
          n: metric.n,
          meanImpressions: metric.mean,
          denominators: c.rates.map(
            ({ name, components, missing, n, numerator, denominator }) => ({
              name,
              components,
              missing,
              n,
              numerator,
              denominator,
            }),
          ),
          summary: `Eigene ${c.unit}-Kohorte · ${c.windowHours} h ±60 s ab Provider-Zeit · Impressionen: arithmetisches Mittel ${metric.mean}, n=${metric.n}; fehlend ${c.attempted - metric.n}. Teilmenge der neuesten 20 bestätigten Post-Versuche; deskriptiv, keine Reichweitenprognose oder kausale Empfehlung. Accountgröße unbekannt; keine belegte Follower-Postattribution. Regel own-baseline-v1; n<10 ist eine unvalidierte Anzeigewarnung.`,
        },
      ];
    });
    return {
      enabled: true,
      reason: entries.length
        ? null
        : read.baseline.cohorts.some((c) =>
              c.metrics.some((m) =>
                m.missing.some((x) => x.reason === "unsafe-aggregate"),
              ),
            )
          ? "PERFORMANCE_CONTENT_UNSAFE_AGGREGATE"
          : "PERFORMANCE_CONTENT_NO_ELIGIBLE_OBSERVATIONS",
      configuration,
      entries,
    };
  },
});
