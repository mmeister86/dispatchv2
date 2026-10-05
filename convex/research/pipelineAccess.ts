import { prerequisites, sameApproval } from "./access";
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { nativeAttempt } from "./providerAccess";
import { generationAttempt } from "../ai/accounting";
import { sha256 } from "../lib/crypto";
import { deliveredSource, materialHash } from "./evidence";
type Ctx = QueryCtx | MutationCtx;
export async function historyMaterial(
  ctx: Ctx,
  o: Doc<"researchOrders">,
  pin: NonNullable<Doc<"researchOrders">["pipeline"]>["history"][number],
) {
  const s = await ctx.db.get(pin.scheduleId),
    t = await ctx.db.get(pin.attemptId),
    ver = await ctx.db.get(pin.versionId);
  const receipt = s?.externalPosts?.find(
    (r) => r.attemptId === pin.attemptId && r.position === pin.position,
  );
  if (
    !s ||
    !t ||
    !ver ||
    s.workspaceId !== o.workspaceId ||
    s.accountId !== o.accountId ||
    s.purpose === "first_write_verification" ||
    t.workspaceId !== o.workspaceId ||
    t.accountId !== o.accountId ||
    t.scheduleId !== s._id ||
    t.versionId !== ver._id ||
    s.versionId !== ver._id ||
    t.stage !== "confirmed" ||
    t.externalId !== pin.externalId ||
    receipt?.externalId !== pin.externalId ||
    receipt.confirmedAt !== pin.confirmedAt ||
    ver.workspaceId !== o.workspaceId ||
    ver.content.accountId !== o.accountId ||
    !ver.content.text[pin.position]
  )
    throw new ConvexError("RESEARCH_HISTORY_CHANGED");
  const text = ver.content.text[pin.position],
    title = ver.content.title;
  if (
    (await sha256(
      JSON.stringify([title, text, pin.confirmedAt, pin.externalId]),
    )) !== pin.materialHash
  )
    throw new ConvexError("RESEARCH_HISTORY_CHANGED");
  return {
    attemptId: pin.attemptId,
    title: title.slice(0, 120),
    text: text.slice(0, 400),
    confirmedAt: pin.confirmedAt,
  };
}
async function materialAuthority(ctx: Ctx, o: Doc<"researchOrders">) {
  if (!o.pipeline || o.pipeline.cleanupState !== "retained")
    throw new ConvexError("RESEARCH_MATERIAL_REMOVED");
  for (const pin of o.pipeline.history) await historyMaterial(ctx, o, pin);
  const profile = await ctx.db.get(o.profileId);
  if (
    !profile ||
    (profile.researchMaterialGeneration ?? 0) !== o.pipeline.materialGeneration
  )
    throw new ConvexError("RESEARCH_MATERIAL_REMOVED");
  let until = o.pipeline.retentionUntil ?? Number.MAX_SAFE_INTEGER;
  if (
    o.pipeline.runId &&
    (!o.approval ||
      !sameApproval(
        o.approval,
        await prerequisites(ctx, profile, o.config, false),
      ))
  )
    throw new ConvexError("RESEARCH_GENERATION_AUTHORITY_CHANGED");
  if (o.pipeline.runId) {
    for (const id of o.approval!.budgetIds)
      until = Math.min(until, (await ctx.db.get(id))!.expiresAt);
    const r = await ctx.db.get(o.pipeline.runId),
      account = await ctx.db.get(o.accountId);
    if (
      !r?.research ||
      r.research.orderId !== o._id ||
      r.actorId !== o.actorId ||
      r.workspaceId !== o.workspaceId ||
      r.accountId !== o.accountId ||
      !account ||
      account.connection !== "connected" ||
      (account.xEvidence?.connectionSequence ?? 0) !==
        r.accountConnectionSequence
    )
      throw new ConvexError("RESEARCH_GENERATION_AUTHORITY_CHANGED");
  }
  return until;
}
export async function currentMaterialProof(ctx: Ctx, o: Doc<"researchOrders">) {
  let proofUntil = await materialAuthority(ctx, o);
  for (const pin of o.pipeline!.contextPins ?? []) {
    const original = await ctx.db.get(pin.orderId);
    if (
      !original ||
      original.workspaceId !== o.workspaceId ||
      original.accountId !== o.accountId
    )
      throw new ConvexError("RESEARCH_CONTEXT_OWNER_INVALID");
    proofUntil = Math.min(proofUntil, await materialAuthority(ctx, original));
    const d = await deliveredSource(ctx, original._id, pin.sourceId);
    proofUntil = Math.min(proofUntil, pin.until, d.until);
    if (
      pin.until <= Date.now() ||
      (await materialHash(d.s)) !== pin.materialHash
    )
      throw new ConvexError("RESEARCH_MATERIAL_CHANGED");
  }
  for (const pin of o.pipeline!.contextEvidence ?? []) {
    const e = await ctx.db.get(pin.evidenceId),
      original = await ctx.db.get(pin.orderId);
    if (
      !e?.payload?.model ||
      e.state !== "review" ||
      e.orderId !== pin.orderId ||
      e.retentionUntil <= Date.now() ||
      e.modelOrigin?.outputHash !== pin.outputHash ||
      !original?.pipeline?.evidenceIds.includes(e._id)
    )
      throw new ConvexError("RESEARCH_CONTEXT_REMOVED");
    proofUntil = Math.min(
      proofUntil,
      e.retentionUntil,
      await materialAuthority(ctx, original),
    );
  }
  const result = [];
  for (const pin of o.pipeline!.sourcePins) {
    const d = await deliveredSource(ctx, o._id, pin.sourceId);
    if (
      pin.until <= Date.now() ||
      (await materialHash(d.s)) !== pin.materialHash
    )
      throw new ConvexError("RESEARCH_MATERIAL_CHANGED");
    proofUntil = Math.min(proofUntil, pin.until, d.until);
    result.push(d);
  }
  return { materials: result, proofUntil };
}
export async function currentMaterials(ctx: Ctx, o: Doc<"researchOrders">) {
  return (await currentMaterialProof(ctx, o)).materials;
}
export async function orderLiability(ctx: Ctx, o: Doc<"researchOrders">) {
  const rows = await ctx.db
    .query("aiAttempts")
    .withIndex("by_researchOrderId_and_key", (q) =>
      q.eq("researchOrderId", o._id),
    )
    .take(31);
  if (rows.length > 30) throw new ConvexError("RESEARCH_ORDER_RECEIPT_INVALID");
  const attempts = [];
  for (const row of rows) attempts.push((await nativeAttempt(ctx, row._id)).t);
  if (o.pipeline?.runId) {
    const r = await ctx.db.get(o.pipeline.runId);
    if (
      !r ||
      r.research?.orderId !== o._id ||
      r.workspaceId !== o.workspaceId ||
      r.accountId !== o.accountId
    )
      throw new ConvexError("RESEARCH_RUN_OWNER_INVALID");
    const rows = await ctx.db
      .query("aiAttempts")
      .withIndex("by_runId_and_key", (q) => q.eq("runId", r._id))
      .take(11);
    if (rows.length > 10)
      throw new ConvexError("RESEARCH_ORDER_RECEIPT_INVALID");
    for (const row of rows) attempts.push(await generationAttempt(ctx, row, r));
  }
  if (attempts.some((t) => t.currency !== o.config.cap?.currency))
    throw new ConvexError("RESEARCH_CURRENCY_INCOMPATIBLE");
  const total = attempts.reduce(
    (sum, t) =>
      sum +
      t.heldMicros +
      (t.state === "settled" ? (t.estimatedMicros ?? 0) : 0),
    0,
  );
  if (!Number.isSafeInteger(total))
    throw new ConvexError("RESEARCH_ORDER_RECEIPT_INVALID");
  const estimated =
    attempts.length && attempts.every((t) => t.estimatedMicros !== null)
      ? attempts.reduce((sum, t) => sum + t.estimatedMicros!, 0)
      : null;
  return {
    total,
    estimated,
    usagePending: attempts.some((t) => t.state !== "settled"),
    attempts,
  };
}
