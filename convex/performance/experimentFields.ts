import { v } from "convex/values";
import { stylePin } from "../planning/strategyFields";
export const spec = v.object({
  hypothesis: v.string(),
  dimension: v.union(
    v.literal("hook"),
    v.literal("format"),
    v.literal("timing"),
  ),
  a: v.string(),
  b: v.string(),
  outcome: v.literal("editorial-decision-v1"),
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
