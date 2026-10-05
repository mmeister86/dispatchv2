import { v } from "convex/values";
import { internalAction, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { credential } from "./providerAccess";
import { searchWeb } from "./webSearch";
import { searchX } from "../integrations/x/research";
import { operation as operationValidator } from "./providerFields";
import { emptyResult } from "./transport";
import type { Doc, Id } from "../_generated/dataModel";
export const execute = internalAction({
  args: { orderId: v.id("researchOrders"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    const o: Doc<"researchOrders"> | null = await ctx.runQuery(
      internal.research.native.executionOrder,
      a,
    );
    if (!o?.native) return null;
    for (const operation of o.native.operations) {
      await executeOperation(ctx, { ...a, operation }, false);
    }
    await ctx.runMutation(internal.research.native.finish, a);
    return null;
  },
});

async function executeOperation(
  ctx: ActionCtx,
  a: {
    orderId: Id<"researchOrders">;
    generation: number;
    operation: Doc<"researchSourcePolicies">["operation"];
  },
  pipeline: boolean,
) {
  if (pipeline) {
    const o = await ctx.runQuery(internal.research.native.executionOrder, {
      orderId: a.orderId,
      generation: a.generation,
    });
    if (!o?.pipeline) return;
    const i = o.native!.operations.indexOf(a.operation);
    if (["completed", "empty", "partial"].includes(o.native!.outcomes[i].state))
      return;
  }
  const args = a;
  const operation = a.operation;
  let attemptId: Id<"aiAttempts"> | null = null;
  try {
    const before = await ctx.runQuery(internal.research.native.context, args);
    const fill = await ctx.runMutation(
      pipeline
        ? internal.research.native.dispatch
        : internal.research.cache.begin,
      args,
    );
    attemptId = fill.attemptId;
    if (fill.cacheHit) {
      await ctx.runMutation(internal.research.native.outcome, {
        ...args,
        state: fill.state,
        reason: null,
        cacheHit: true,
      });
      return;
    }
    const current = await ctx.runQuery(internal.research.native.context, args),
      key = credential(operation);
    if (!key) throw new Error("RESEARCH_SOURCE_CONFIGURATION_REQUIRED");
    if (current.policy._id !== before.policy._id)
      throw new Error("RESEARCH_SOURCE_CHANGED");
    const result =
      operation === "web-search"
        ? await searchWeb(current.order, current.policy, key)
        : await searchX(current.order, current.policy, key);
    await ctx.runMutation(internal.research.cache.settle, {
      attemptId: attemptId!,
      units: result.units,
      reportedCost: result.reportedCost,
      costInvalid: result.costInvalid,
      errorCode: result.reason,
    });
    attemptId = null;
    const state = await ctx.runMutation(internal.research.cache.commit, {
      orderId: a.orderId,
      generation: a.generation,
      cacheId: fill.cacheId,
      state: result.state,
      reason: result.reason,
      sources: result.sources,
      truncated: result.truncated,
    });
    await ctx.runMutation(internal.research.native.outcome, {
      ...args,
      state,
      reason: state === "removed" ? "RESEARCH_SOURCE_REMOVED" : result.reason,
      cacheHit: false,
    });
  } catch (e) {
    if (attemptId) {
      const r = emptyResult();
      await ctx.runMutation(internal.research.cache.settle, {
        attemptId,
        units: r.units,
        reportedCost: null,
        costInvalid: false,
        errorCode: "RESEARCH_PROVIDER_UNAVAILABLE",
      });
    }
    const message = e instanceof Error ? e.message : String(e),
      budget = message.includes("BUDGET_EXHAUSTED"),
      legacy = message.includes(
        "RESEARCH_LEGACY_INTENT_RECONCILIATION_REQUIRED",
      ),
      config =
        message.includes("CONFIGURATION") ||
        message.includes("SOURCE_CHANGED") ||
        message.includes("ACCOUNT_CHANGED");
    await ctx.runMutation(internal.research.native.outcome, {
      ...args,
      state: budget
        ? "budget_exhausted"
        : config
          ? "configuration_required"
          : "unknown",
      reason: legacy
        ? "RESEARCH_LEGACY_INTENT_RECONCILIATION_REQUIRED"
        : budget
          ? "RESEARCH_BUDGET_EXHAUSTED"
          : config
            ? "RESEARCH_SOURCE_CONFIGURATION_REQUIRED"
            : "RESEARCH_PROVIDER_UNAVAILABLE",
      cacheHit: false,
    });
  }
}
export const operation = internalAction({
  args: {
    orderId: v.id("researchOrders"),
    generation: v.number(),
    operation: operationValidator,
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    await executeOperation(ctx, a, true);
    return null;
  },
});
