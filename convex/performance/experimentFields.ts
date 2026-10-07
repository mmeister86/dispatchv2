import { v } from "convex/values";
import { stylePin } from "../planning/strategyFields";
import { windowHours } from "./fields";
export const publicationSpec = v.object({
  metric: v.union(
    ...(
      [
        "impressions",
        "likes",
        "replies",
        "reposts",
        "quotes",
        "bookmarks",
        "url_clicks",
        "profile_clicks",
      ] as const
    ).map(v.literal),
  ),
  windowHours,
  policyId: v.id("performancePolicies"),
  policyFingerprint: v.string(),
  rightsEvidence: v.string(),
  explanation: v.string(),
  expiresAt: v.number(),
});
const publicationPin = v.object({
  scheduleId: v.id("schedules"),
  approvalId: v.id("approvals"),
  generation: v.number(),
  connectionSequence: v.number(),
  providerIdentity: v.string(),
  admittedAt: v.number(),
});
export const publicationCounts = v.object({
  assigned: v.number(),
  confirmed: v.number(),
  measured: v.number(),
  partial: v.number(),
  unknown: v.number(),
  excluded: v.number(),
  withdrawn: v.number(),
  missing: v.number(),
});
const amount = v.union(v.number(), v.null());
const armMetrics = v.object({
  n: v.number(),
  sum: amount,
  mean: amount,
  from: amount,
  to: amount,
});
export const publicationView = v.object({
  counts: publicationCounts,
  arms: v.object({ A: publicationCounts, B: publicationCounts }),
  units: v.array(
    v.object({
      assignmentId: v.id("editorialExperimentAssignments"),
      scheduleId: v.union(v.id("schedules"), v.null()),
      arm: v.union(v.literal("A"), v.literal("B"), v.null()),
      outcome: v.string(),
      reason: v.union(v.string(), v.null()),
      value: amount,
      firstSendAt: amount,
      until: amount,
    }),
  ),
  cohorts: v.array(
    v.object({
      key: v.string(),
      format: v.string(),
      media: v.string(),
      metric: v.string(),
      rawField: v.string(),
      definition: v.string(),
      definitionVersion: v.string(),
      dialect: v.string(),
      windowHours: v.number(),
      A: armMetrics,
      B: armMetrics,
      difference: amount,
    }),
  ),
});
export const spec = v.object({
  hypothesis: v.string(),
  dimension: v.union(
    v.literal("hook"),
    v.literal("format"),
    v.literal("timing"),
  ),
  a: v.string(),
  b: v.string(),
  outcome: v.union(
    v.literal("editorial-decision-v1"),
    v.literal("publication-count-v1"),
  ),
  publication: v.optional(publicationSpec),
  startsAt: v.number(),
  endsAt: v.number(),
  sampleCap: v.number(),
  stopCondition: v.string(),
  context: v.string(),
  frequency: v.string(),
});
export const unit = v.object({
  versionId: v.id("draftVersions"),
  reviewerId: v.id("users"),
  arm: v.union(v.literal("A"), v.literal("B")),
  planItemId: v.union(v.id("contentPlanItems"), v.null()),
});
export const scope = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
};
export const experimentFields = {
  ...scope,
  actorId: v.id("users"),
  membershipId: v.id("memberships"),
  actorFingerprint: v.string(),
  spec: v.union(spec, v.null()),
  revision: v.number(),
  state: v.union(
    v.literal("planned"),
    v.literal("running"),
    v.literal("stopped"),
  ),
  startSequence: v.union(v.number(), v.null()),
  stopSequence: v.union(v.number(), v.null()),
  startedAt: v.union(v.number(), v.null()),
  stoppedAt: v.union(v.number(), v.null()),
  endsAt: v.number(),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
  createdAt: v.number(),
};
export const commandFields = {
  ...scope,
  experimentId: v.id("editorialExperiments"),
  actorId: v.id("users"),
  commandKey: v.string(),
  fingerprint: v.union(v.string(), v.null()),
  revision: v.number(),
  sourceUnavailable: v.boolean(),
  createdAt: v.number(),
};
export const assignmentFields = {
  publication: v.optional(v.union(publicationPin, v.null())),
  ...scope,
  experimentId: v.id("editorialExperiments"),
  draftId: v.id("drafts"),
  versionId: v.id("draftVersions"),
  reviewerId: v.id("users"),
  reviewerMembershipId: v.id("memberships"),
  reviewerFingerprint: v.string(),
  arm: v.union(v.literal("A"), v.literal("B"), v.null()),
  planItemId: v.union(v.id("contentPlanItems"), v.null()),
  seriesVersionId: v.union(v.id("planningSeriesVersions"), v.null()),
  style: v.union(stylePin, v.null()),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
};
// IDs and original horizons only. Native feedback/vector rows remain the evidence.
export const bindingFields = {
  snapshotId: v.optional(v.union(v.id("performanceSnapshots"), v.null())),
  ...scope,
  assignmentId: v.id("editorialExperimentAssignments"),
  vectorId: v.union(v.id("contentEmbeddings"), v.null()),
  draftVersionId: v.union(v.id("draftVersions"), v.null()),
  fingerprint: v.union(v.string(), v.null()),
  sourceUntil: v.union(v.number(), v.null()),
  sourceUnavailable: v.boolean(),
};
export const result = v.object({
  experimentId: v.id("editorialExperiments"),
  revision: v.number(),
  receiptId: v.id("editorialExperimentCommands"),
});
export const action = v.union(
  v.object({ kind: v.literal("declare"), spec, units: v.array(unit) }),
  v.object({
    kind: v.literal("declarePublication"),
    spec,
    units: v.array(
      v.object({
        scheduleId: v.id("schedules"),
        arm: v.union(v.literal("A"), v.literal("B")),
        planItemId: v.union(v.id("contentPlanItems"), v.null()),
      }),
    ),
  }),
  v.object({ kind: v.literal("withdraw") }),
  v.object({ kind: v.literal("start") }),
  v.object({ kind: v.literal("stop") }),
);

export const counts = v.object({
  enrolled: v.number(),
  decided: v.number(),
  accept: v.number(),
  reject: v.number(),
  conflict: v.number(),
  noFeedback: v.number(),
  withdrawn: v.number(),
  edited: v.number(),
  missingEdits: v.number(),
});
export const detail = v.object({
  publication: v.union(publicationView, v.null()),
  experimentId: v.id("editorialExperiments"),
  revision: v.number(),
  state: v.string(),
  spec: v.union(spec, v.null()),
  sourceUntil: v.union(v.number(), v.null()),
  endsAt: v.number(),
  enrollmentCapped: v.boolean(),
  counts,
  arms: v.object({ A: counts, B: counts }),
  units: v.array(
    v.object({
      assignmentId: v.id("editorialExperimentAssignments"),
      versionId: v.id("draftVersions"),
      reviewerId: v.id("users"),
      arm: v.union(v.literal("A"), v.literal("B"), v.null()),
      outcome: v.string(),
      editCount: v.number(),
      editExtent: v.union(v.number(), v.null()),
      missingEdits: v.number(),
      until: v.union(v.number(), v.null()),
    }),
  ),
});
export const catalog = v.object({
  publicationConfiguration: v.union(
    v.object({
      policyId: v.id("performancePolicies"),
      policyFingerprint: v.string(),
      version: v.string(),
      dialect: v.string(),
      windows: v.array(v.number()),
      fields: v.array(v.string()),
      expiresAt: v.number(),
    }),
    v.null(),
  ),
  schedules: v.array(
    v.object({
      scheduleId: v.id("schedules"),
      versionId: v.id("draftVersions"),
      at: v.number(),
      positions: v.number(),
    }),
  ),
  experiments: v.array(
    v.object({
      experimentId: v.id("editorialExperiments"),
      revision: v.number(),
      state: v.string(),
    }),
  ),
  candidates: v.array(
    v.object({
      versionId: v.id("draftVersions"),
      number: v.number(),
      draftId: v.id("drafts"),
    }),
  ),
  reviewers: v.array(v.object({ reviewerId: v.id("users"), role: v.string() })),
});
