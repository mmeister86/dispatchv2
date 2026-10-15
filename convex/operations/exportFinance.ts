import { ConvexError, v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import {
  workspaceQuery,
  requireReference,
  requireRole,
} from "../lib/authorization";
import { role } from "../schema";
import {
  EXPORT_PAGE_CANDIDATES,
  EXPORT_PAGE_MAX_BYTES,
  numeric,
  proofContext,
} from "./exportShared";
import {
  attemptFields as generationFields,
  generationReservationFields,
  runFields,
  budgetFields,
} from "../ai/fields";
import { nativeAttemptFields } from "../research/providerFields";
import { orderFields } from "../research/fields";
import {
  attemptFields as analyzerFields,
  routingAttemptFields,
  verificationAttemptFields,
  finalReservationFields,
} from "../ai/jev/types";
import { metricsAttemptFields } from "../performance/fields";
import { historyAttemptFields } from "../performance/historyFields";
import { attemptFields as embeddingAttemptFields } from "../content/similarityFields";
import { generationAttempt } from "../ai/accounting";
import { reservation } from "../ai/jev/composite";
import { nativeAttempt } from "../research/providerAccess";
import { analyzerReceipt } from "../ai/jev/access";
import { routingReceipt } from "../ai/jev/routing";
import { receipt as verificationReceipt } from "../ai/jev/verify";
import { embeddingAttempt } from "../content/similarity";
import { historyAttempt } from "../performance/history";
import { metricsAttempt } from "../performance/snapshots";
function pick<T, const K extends readonly (keyof T)[]>(
  r: T,
  keys: K,
): Pick<T, K[number]> {
  return Object.fromEntries(
    keys.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]),
  ) as Pick<T, K[number]>;
}
function binding(ok: unknown): asserts ok {
  if (!ok) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
export const family = v.union(
  v.literal("ownFinanceRuns"),
  v.literal("ownFinanceOrders"),
  v.literal("ownFinanceReceipts"),
  v.literal("runUsage"),
  v.literal("orderUsage"),
  v.literal("metricsUsage"),
  v.literal("historyUsage"),
  v.literal("usageBudgets"),
  v.literal("businessFinanceRuns"),
  v.literal("businessRunUsage"),
  v.literal("publicFinanceOrders"),
  v.literal("publicOrderUsage"),
  v.literal("researchRunUsage"),
);
export type FinanceFamily = Infer<typeof family>;
const publicPurpose = v.union(
  v.literal("summary"),
  v.literal("research"),
  v.literal("draft"),
  v.literal("plan"),
);
const namespace = v.union(
  v.literal("generation"),
  v.literal("native-search"),
  v.literal("jev"),
  v.literal("metrics"),
  v.literal("history"),
  v.literal("embedding"),
);
const budgetScope = v.union(v.literal("workspace"), v.literal("account"));
const runKeys = [
  "accountId",
  "actorId",
  "purpose",
  "state",
  "generation",
  "policyVersion",
  "promptVersion",
  "createdAt",
  "deadline",
  "executionFinishedAt",
  "attempts",
  "toolSteps",
] as const;
const orderKeys = [
  "accountId",
  "actorId",
  "profileId",
  "profileVersionId",
  "occasion",
  "state",
  "generation",
  "createdAt",
] as const;
const budgetKeys = [
  "scope",
  "workspaceId",
  "accountId",
  "policyVersion",
  "currency",
  "purposes",
  "approvedBy",
  "expiresAt",
  "limitMicros",
  "heldMicros",
  "spentMicros",
] as const;
const keys0 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "runId",
  "generation",
  "model",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "inputTokens",
  "outputTokens",
  "reportedCost",
  "reportedCurrency",
  "reportedCostInvalid",
  "compositeParentId",
  "compositeStage",
] as const;
const keys1 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "runId",
  "generation",
  "model",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "inputTokens",
  "outputTokens",
  "reportedCost",
  "reportedCurrency",
  "reportedCostInvalid",
  "compositeParentId",
  "compositeStage",
  "accountId",
  "actorId",
  "maxInputTokens",
  "maxOutputTokens",
  "compositeRootRunId",
  "reservedAt",
] as const;
const keys2 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "researchOrderId",
  "operation",
  "generation",
  "policyId",
  "unit",
  "unitMicros",
  "costCurrencyEvidence",
  "reportedCost",
  "reportedCurrency",
  "reportedCostInvalid",
  "units",
  "dispatchedAt",
  "intentVersion",
] as const;
const keys3 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "actorId",
  "purpose",
  "operation",
  "draftId",
  "draftVersionId",
  "algorithmId",
  "audienceId",
  "selectionRevision",
  "mode",
  "deadline",
  "policyId",
  "controlId",
  "questionVersion",
  "normalizationVersion",
  "model",
  "resolvedModel",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "maxInputTokens",
  "maxOutputTokens",
  "inputTokens",
  "outputTokens",
  "latencyMs",
  "outcome",
  "fallback",
] as const;
const keys4 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "actorId",
  "purpose",
  "operation",
  "routingOperationId",
  "inputVersionId",
  "policyId",
  "controlId",
  "questionVersion",
  "normalizationVersion",
  "model",
  "resolvedModel",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "maxInputTokens",
  "maxOutputTokens",
  "inputTokens",
  "outputTokens",
  "latencyMs",
  "outcome",
  "fallback",
] as const;
const keys5 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "actorId",
  "purpose",
  "operation",
  "inputVersionId",
  "policyId",
  "controlId",
  "questionVersion",
  "normalizationVersion",
  "model",
  "resolvedModel",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "maxInputTokens",
  "maxOutputTokens",
  "inputTokens",
  "outputTokens",
  "latencyMs",
  "outcome",
  "fallback",
  "contentRequestId",
  "candidateVersionId",
  "producerRunId",
  "thresholdVersion",
  "compositeParentId",
  "compositeStage",
  "compositeRootRunId",
] as const;
const keys6 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "actorId",
  "purpose",
  "operation",
  "inputVersionId",
  "policyId",
  "controlId",
  "questionVersion",
  "normalizationVersion",
  "model",
  "resolvedModel",
  "inputMicrosPerMillion",
  "outputMicrosPerMillion",
  "maxInputTokens",
  "maxOutputTokens",
  "inputTokens",
  "outputTokens",
  "latencyMs",
  "outcome",
  "fallback",
  "contentRequestId",
  "producerRunId",
  "thresholdVersion",
  "compositeParentId",
  "compositeStage",
  "compositeRootRunId",
  "deadline",
  "reservedAt",
] as const;
const keys7 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "purpose",
  "snapshotId",
  "policyId",
  "generation",
  "unit",
  "unitMicros",
  "inputTokens",
  "outputTokens",
  "reportedCurrency",
  "reportedCostInvalid",
  "reportedCost",
] as const;
const keys8 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "purpose",
  "historyJobId",
  "policyId",
  "generation",
  "unit",
  "unitMicros",
  "inputTokens",
  "outputTokens",
  "reportedCurrency",
  "reportedCostInvalid",
  "reportedCost",
  "page",
  "maxResults",
  "resourceCount",
] as const;
const keys9 = [
  "owner",
  "currency",
  "policyVersion",
  "provider",
  "state",
  "reservedMicros",
  "heldMicros",
  "estimatedMicros",
  "billedMicros",
  "sentAt",
  "settledAt",
  "accountId",
  "actorId",
  "purpose",
  "controlId",
  "generation",
  "policyId",
  "model",
  "identity",
  "inputMicrosPerMillion",
  "maxInputTokens",
  "inputTokens",
  "createdAt",
  "deadline",
  "sourceUnavailable",
] as const;
const receiptRow = v.union(
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(generationFields, keys0),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(generationReservationFields, keys1),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(nativeAttemptFields, keys2),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(analyzerFields, keys3),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(routingAttemptFields, keys4),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(verificationAttemptFields, keys5),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(finalReservationFields, keys6),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(metricsAttemptFields, keys7),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(historyAttemptFields, keys8),
  }),
  v.object({
    id: v.id("aiAttempts"),
    createdInDatabaseAt: v.number(),
    ...pick(embeddingAttemptFields, keys9),
  }),
);
const row = v.union(
  receiptRow,
  v.object({
    id: v.id("agentRuns"),
    createdInDatabaseAt: v.number(),
    ...pick(runFields, runKeys),
  }),
  v.object({
    id: v.id("researchOrders"),
    createdInDatabaseAt: v.number(),
    ...pick(orderFields, orderKeys),
  }),
  v.object({
    id: v.id("aiBudgets"),
    createdInDatabaseAt: v.number(),
    namespace,
    ...pick(budgetFields, budgetKeys),
  }),
);
async function finance(
  ctx: QueryCtx,
  t: Doc<"aiAttempts">,
): Promise<Infer<typeof receiptRow>> {
  const system = { id: t._id, createdInDatabaseAt: t._creationTime };
  numeric(t);
  for (const key of [
    "reservedMicros",
    "heldMicros",
    "estimatedMicros",
    "billedMicros",
    "inputTokens",
    "outputTokens",
    "maxInputTokens",
    "maxOutputTokens",
    "unitMicros",
    "resourceCount",
    "units",
  ]) {
    const n = (t as unknown as Record<string, unknown>)[key];
    if (
      n !== undefined &&
      n !== null &&
      (!Number.isSafeInteger(n) || (n as number) < 0)
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
  }
  switch (t.owner) {
    case undefined:
    case "generation": {
      await generationAttempt(ctx, t, await ctx.db.get(t.runId));
      return { ...system, ...pick(t, keys0) };
    }
    case "generation-reservation":
      await reservation(ctx, t);
      return { ...system, ...pick(t, keys1) };
    case "native-search":
      await nativeAttempt(ctx, t._id);
      return { ...system, ...pick(t, keys2) };
    case "jev-analyzer":
      await analyzerReceipt(ctx, t._id);
      return { ...system, ...pick(t, keys3) };
    case "jev-intent-router":
      await routingReceipt(ctx, t._id);
      return { ...system, ...pick(t, keys4) };
    case "jev-output-verifier":
      await verificationReceipt(ctx, t._id, {
        contentRequestId: t.contentRequestId,
        candidateVersionId: t.candidateVersionId,
        contentHash: t.contentHash,
        commandFingerprint: t.commandFingerprint,
        compositeStage: t.compositeStage,
      });
      return { ...system, ...pick(t, keys5) };
    case "jev-output-verifier-reservation":
      await reservation(ctx, t);
      return { ...system, ...pick(t, keys6) };
    case "own-metrics":
      await metricsAttempt(ctx, t._id);
      return { ...system, ...pick(t, keys7) };
    case "own-history":
      await historyAttempt(ctx, t._id);
      return { ...system, ...pick(t, keys8) };
    case "own-content-embedding":
      await embeddingAttempt(ctx, t._id);
      return { ...system, ...pick(t, keys9) };
  }
}
export const page = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    family,
    accountId: v.id("socialAccounts"),
    purpose: v.optional(publicPurpose),
    profileId: v.optional(v.id("researchProfiles")),
    runId: v.optional(v.id("agentRuns")),
    orderId: v.optional(v.id("researchOrders")),
    namespace: v.optional(namespace),
    budgetScope: v.optional(budgetScope),
    cursor: v.union(v.string(), v.null()),
    creationUpperBound: v.union(v.number(), v.null()),
  },
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    workspaceId: v.id("workspaces"),
    role,
    observedAt: v.number(),
    proofValidUntil: v.number(),
    creationUpperBound: v.number(),
    cursor: v.string(),
    isDone: v.boolean(),
    accountId: v.id("socialAccounts"),
    purpose: v.union(publicPurpose, v.null()),
    profileId: v.union(v.id("researchProfiles"), v.null()),
    runId: v.union(v.id("agentRuns"), v.null()),
    orderId: v.union(v.id("researchOrders"), v.null()),
    namespace: v.union(namespace, v.null()),
    budgetScope: v.union(budgetScope, v.null()),
    data: v.object({
      format: v.literal("dispatch-workspace-finance"),
      version: v.literal(1),
      workspaceId: v.id("workspaces"),
      selection: v.object({ family, rows: v.array(row) }),
    }),
  }),
  handler: async (original, a) => {
    const sessionId = (await original.auth.getUserIdentity())?.sessionId;
    if (typeof sessionId !== "string" || !sessionId)
      throw new ConvexError("Unauthenticated");
    if (
      !a.expectedAuthId ||
      a.expectedAuthId.length > 256 ||
      !a.expectedSessionId ||
      a.expectedSessionId.length > 256 ||
      !a.requestKey ||
      a.requestKey.length > 64
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      a.expectedAuthId !== original.user.authId ||
      a.expectedSessionId !== sessionId ||
      original.user.activeWorkspaceId !== original.workspace._id
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    if (
      [
        "metricsUsage",
        "historyUsage",
        "usageBudgets",
        "businessFinanceRuns",
        "businessRunUsage",
        "publicFinanceOrders",
        "publicOrderUsage",
      ].includes(a.family)
    )
      requireRole(original.membership, ["Owner", "Admin"]);
    if (
      ["runUsage", "businessRunUsage"].includes(a.family) !==
        (a.runId !== undefined) ||
      ["orderUsage", "publicOrderUsage", "researchRunUsage"].includes(
        a.family,
      ) !==
        (a.orderId !== undefined) ||
      (a.family === "usageBudgets") !== (a.namespace !== undefined) ||
      (a.family === "usageBudgets") !== (a.budgetScope !== undefined)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    if (
      ["businessFinanceRuns", "businessRunUsage"].includes(a.family) !==
        (a.purpose !== undefined) ||
      (a.family === "publicFinanceOrders") !== (a.profileId !== undefined)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const observedAt = Date.now();
    numeric(a);
    numeric(observedAt);
    if (
      observedAt < 0 ||
      (a.cursor === null) !== (a.creationUpperBound === null) ||
      (a.cursor !== null && (!a.cursor || a.cursor.length > 16384)) ||
      (a.creationUpperBound !== null &&
        (a.creationUpperBound < 0 || a.creationUpperBound > observedAt))
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const ws = original.workspace._id,
      ctx = proofContext(original, ws),
      creationUpperBound = a.creationUpperBound ?? observedAt;
    requireReference(ws, await ctx.db.get(a.accountId));
    let selected: { continueCursor: string; isDone: boolean };
    const rows: Infer<typeof row>[] = [];
    switch (a.family) {
      case "ownFinanceRuns": {
        const p = await ctx.db
          .query("agentRuns")
          .withIndex("by_workspace_account_actor", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(
            r.actorId === original.user._id && r.accountId === a.accountId,
          );
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, runKeys),
          });
        }
        break;
      }
      case "ownFinanceOrders": {
        const p = await ctx.db
          .query("researchOrders")
          .withIndex("by_workspace_account_actor", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(
            r.actorId === original.user._id && r.accountId === a.accountId,
          );
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, orderKeys),
          });
        }
        break;
      }
      case "ownFinanceReceipts": {
        const p = await ctx.db
          .query("aiAttempts")
          .withIndex("by_workspace_account_actor", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId)
              .eq("actorId", original.user._id)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const t of p.page) {
          binding(
            "actorId" in t &&
              t.actorId === original.user._id &&
              "accountId" in t &&
              t.accountId === a.accountId,
          );
          rows.push(await finance(ctx, t));
        }
        break;
      }
      case "businessRunUsage":
      case "runUsage": {
        const r = await ctx.db.get(a.runId!);
        binding(
          r &&
            r.accountId === a.accountId &&
            (a.family === "runUsage"
              ? r.actorId === original.user._id
              : r.purpose === a.purpose &&
                r.conversationId === undefined &&
                r.chatOperationId === undefined &&
                r.research === undefined),
        );
        const p = await ctx.db
          .query("aiAttempts")
          .withIndex("by_runId", (q) =>
            q.eq("runId", r._id).lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const t of p.page) {
          binding(
            t.owner === undefined ||
              t.owner === "generation" ||
              t.owner === "generation-reservation",
          );
          binding(t.runId === r._id);
          rows.push(await finance(ctx, t));
        }
        break;
      }
      case "publicOrderUsage":
      case "orderUsage": {
        const o = await ctx.db.get(a.orderId!);
        binding(
          o &&
            o.accountId === a.accountId &&
            (a.family === "orderUsage"
              ? o.actorId === original.user._id
              : o.targetedChat === undefined),
        );
        const p = await ctx.db
          .query("aiAttempts")
          .withIndex("by_researchOrderId", (q) =>
            q
              .eq("researchOrderId", o._id)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const t of p.page) {
          binding(
            t.owner === "native-search" &&
              t.accountId === a.accountId &&
              t.researchOrderId === o._id,
          );
          rows.push(await finance(ctx, t));
        }
        break;
      }
      case "businessFinanceRuns": {
        const p = await ctx.db
          .query("agentRuns")
          .withIndex("by_public_finance", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId)
              .eq("purpose", a.purpose!)
              .eq("conversationId", undefined)
              .eq("chatOperationId", undefined)
              .eq("research.orderId", undefined)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const r of p.page) {
          binding(
            r.accountId === a.accountId &&
              r.purpose === a.purpose &&
              r.conversationId === undefined &&
              r.chatOperationId === undefined &&
              r.research === undefined,
          );
          rows.push({
            id: r._id,
            createdInDatabaseAt: r._creationTime,
            ...pick(r, runKeys),
          });
        }
        break;
      }
      case "publicFinanceOrders": {
        const profile = await ctx.db.get(a.profileId!);
        binding(profile && profile.accountId === a.accountId);
        const p = await ctx.db
          .query("researchOrders")
          .withIndex("by_public_finance", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId)
              .eq("profileId", profile._id)
              .eq("targetedChat.conversationId", undefined)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const o of p.page) {
          binding(
            o.accountId === a.accountId &&
              o.profileId === profile._id &&
              o.targetedChat === undefined,
          );
          rows.push({
            id: o._id,
            createdInDatabaseAt: o._creationTime,
            ...pick(o, orderKeys),
          });
        }
        break;
      }
      case "researchRunUsage": {
        const o = await ctx.db.get(a.orderId!);
        binding(o && o.accountId === a.accountId);
        if (o.actorId !== original.user._id) {
          requireRole(original.membership, ["Owner", "Admin"]);
          binding(o.targetedChat === undefined);
        }
        binding(o.pipeline?.runId);
        const r = await ctx.db.get(o.pipeline.runId);
        binding(
          r &&
            r.accountId === a.accountId &&
            r.actorId === o.actorId &&
            r.purpose === "research" &&
            r.research?.orderId === o._id &&
            r.research.generation === o.generation &&
            r.conversationId === undefined &&
            r.chatOperationId === undefined,
        );
        const p = await ctx.db
          .query("aiAttempts")
          .withIndex("by_runId", (q) =>
            q.eq("runId", r._id).lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const t of p.page) {
          binding(
            (t.owner === undefined || t.owner === "generation") &&
              t.runId === r._id,
          );
          rows.push(await finance(ctx, t));
        }
        break;
      }
      case "metricsUsage":
      case "historyUsage": {
        const owner =
          a.family === "metricsUsage" ? "own-metrics" : "own-history";
        const p = await ctx.db
          .query("aiAttempts")
          .withIndex("by_workspace_account_owner", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("accountId", a.accountId)
              .eq("owner", owner)
              .lte("_creationTime", creationUpperBound),
          )
          .order("asc")
          .paginate({
            numItems: EXPORT_PAGE_CANDIDATES,
            cursor: a.cursor,
            maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
          });
        selected = p;
        for (const t of p.page) {
          binding(
            t.owner === owner &&
              "accountId" in t &&
              t.accountId === a.accountId,
          );
          rows.push(await finance(ctx, t));
        }
        break;
      }
      case "usageBudgets": {
        if (a.cursor !== null) throw new ConvexError("EXPORT_REQUEST_INVALID");
        const prefix =
          a.namespace === "generation"
            ? ""
            : a.namespace === "native-search"
              ? "native:"
              : `${a.namespace}:`;
        const key =
          prefix +
          (a.budgetScope === "workspace"
            ? `workspace:${ws}`
            : `account:${a.accountId}`);
        const b = await ctx.db
          .query("aiBudgets")
          .withIndex("by_key", (q) => q.eq("key", key))
          .unique();
        if (b) {
          binding(
            b.key === key &&
              b.scope === a.budgetScope &&
              b.workspaceId === ws &&
              (a.budgetScope === "account"
                ? b.accountId === a.accountId
                : b.accountId === undefined),
          );
          numeric(b);
          if (b._creationTime <= creationUpperBound)
            rows.push({
              id: b._id,
              createdInDatabaseAt: b._creationTime,
              namespace: a.namespace!,
              ...pick(b, budgetKeys),
            });
        }
        selected = { continueCursor: "complete", isDone: true };
        break;
      }
    }
    const result = {
      authId: original.user.authId,
      sessionId,
      requestKey: a.requestKey,
      workspaceId: ws,
      role: original.membership.role,
      observedAt,
      proofValidUntil: observedAt + 30000,
      creationUpperBound,
      cursor: selected.continueCursor,
      isDone: selected.isDone,
      accountId: a.accountId,
      purpose: a.purpose ?? null,
      profileId: a.profileId ?? null,
      runId: a.runId ?? null,
      orderId: a.orderId ?? null,
      namespace: a.namespace ?? null,
      budgetScope: a.budgetScope ?? null,
      data: {
        format: "dispatch-workspace-finance" as const,
        version: 1 as const,
        workspaceId: ws,
        selection: { family: a.family, rows },
      },
    };
    numeric(result);
    const now = Date.now();
    numeric(now);
    if (
      now < observedAt ||
      now >= result.proofValidUntil ||
      new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024
    )
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
