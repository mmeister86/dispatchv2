import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import {
  currentProfile,
  liveAuthority,
  prerequisites,
  sameApproval,
} from "./access";
import { nextOccurrence } from "./time";
import { admit } from "./runs";
export async function cancelSchedule(
  ctx: MutationCtx,
  p: Doc<"researchProfiles">,
) {
  if (p.scheduledJobId) await ctx.scheduler.cancel(p.scheduledJobId);
}
export async function planSchedule(
  ctx: MutationCtx,
  p: Doc<"researchProfiles">,
  config: Doc<"researchProfileVersions">["config"],
) {
  const at = nextOccurrence(config, Date.now());
  if (at === null) return;
  const scheduledJobId = await ctx.scheduler.runAt(
    at,
    internal.research.schedules.fire,
    { profileId: p._id, generation: p.scheduleGeneration, at },
  );
  await ctx.db.patch(p._id, { nextAt: at, scheduledJobId });
}
export const fire = internalMutation({
  args: {
    profileId: v.id("researchProfiles"),
    generation: v.number(),
    at: v.number(),
  },
  returns: v.union(v.id("researchOrders"), v.null()),
  handler: async (ctx, a) => {
    const p = await ctx.db.get(a.profileId);
    if (!p) return null;
    const key = `schedule-${a.generation}-${a.at}`;
    const old = await ctx.db
      .query("researchOrders")
      .withIndex("by_profileId_and_occasion_and_operationKey", (q) =>
        q
          .eq("profileId", p._id)
          .eq("occasion", "scheduled")
          .eq("operationKey", key),
      )
      .unique();
    if (old) return old._id;
    if (
      !Number.isSafeInteger(a.at) ||
      !Number.isSafeInteger(a.generation) ||
      a.at > Date.now() ||
      !p.scheduleActive ||
      !p.scheduleActorId ||
      p.scheduleGeneration !== a.generation ||
      p.nextAt !== a.at ||
      !p.scheduleApproval ||
      p.scheduleAccountSequence === null
    )
      return null;
    const { version } = await currentProfile(ctx, p.workspaceId, p._id);
    try {
      await liveAuthority(ctx, p, p.scheduleActorId, p.scheduleAccountSequence);
      const approval = await prerequisites(ctx, p, version.config);
      if (!sameApproval(approval, p.scheduleApproval))
        throw new Error("configuration changed");
    } catch (e) {
      await ctx.db.patch(p._id, {
        scheduleActive: false,
        nextAt: null,
        scheduledJobId: null,
        scheduleReason:
          e instanceof ConvexError && typeof e.data === "string"
            ? e.data
            : "RESEARCH_CONFIGURATION_CHANGED",
      });
      return null;
    }
    const id = await admit(
      ctx,
      p,
      version,
      p.scheduleActorId,
      "scheduled",
      key,
      JSON.stringify(a),
      { generation: a.generation, at: a.at },
    );
    await planSchedule(ctx, p, version.config);
    return id;
  },
});
