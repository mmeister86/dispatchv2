import { operationalUntil } from "../lib/operationalRetention";
import {
  materialWalk,
  enterMaterial,
  type MaterialWalk,
} from "../research/pipelineAccess";
import { rethrowUnexpectedSourceError } from "../lib/sourceProof";
import { ConvexError, v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  type QueryCtx,
  type MutationCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import {
  workspaceMutation,
  workspaceQuery,
  requireReference,
  requireRole,
  requireActiveWorkspace,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
import { evidence } from "../content/feedback";
import { projectDraft } from "../research/contentProof";
import {
  action,
  result,
  versionDoc,
  controlDoc,
  proposalDoc,
  commandDoc,
  versionCatalog,
  proposalCatalog,
  commandCatalog,
} from "./styleFields";
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value;
const minimum = (...values: (number | null)[]) => {
  const n = Math.min(...values.map((x) => x ?? Infinity));
  if (n <= Date.now()) throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
  return Number.isFinite(n) ? n : null;
};
function text(s: string, max: number, required = false) {
  if (
    Array.from(s).length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/.test(s) ||
    (required && !s.trim())
  )
    throw new ConvexError("STYLE_INPUT_INVALID");
}
function validate(input: NonNullable<Doc<"styleProfileVersions">["payload"]>) {
  text(input.author, 100);
  text(input.tone, 1000);
  text(input.positioning, 2000);
  for (const [list, count, max] of [
    [input.experiences, 10, 500],
    [input.examples, 5, 4000],
    [input.forbidden, 30, 200],
  ] as const) {
    if (list.length > count) throw new ConvexError("STYLE_INPUT_INVALID");
    for (const s of list) text(s, max);
  }
  const pillars = input.pillars.map((p) => ({
    name: p.name.trim(),
    weight: p.weight,
  }));
  if (
    !pillars.length ||
    pillars.length > 12 ||
    new Set(pillars.map((p) => p.name)).size !== pillars.length ||
    pillars.some(
      (p) => !Number.isInteger(p.weight) || p.weight < 0 || p.weight > 100,
    ) ||
    pillars.reduce((n, p) => n + p.weight, 0) !== 100
  )
    throw new ConvexError("STYLE_INPUT_INVALID");
  for (const p of pillars) text(p.name, 100, true);
  const payload = {
    author: input.author,
    experiences: input.experiences,
    tone: input.tone,
    positioning: input.positioning,
    pillars,
    examples: input.examples,
    forbidden: input.forbidden,
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 24000)
    throw new ConvexError("STYLE_INPUT_INVALID");
  return payload;
}
type Reads = {
  rows: Map<string, Promise<Doc<TableNames> | null>>;
  authorities: Map<string, Promise<void>>;
  feedback: Map<string, ReturnType<typeof evidence>>;
};
const reading = (): Reads => ({
  rows: new Map(),
  authorities: new Map(),
  feedback: new Map(),
});
async function read<T extends TableNames>(
  ctx: QueryCtx,
  id: Id<T>,
  reads?: Reads,
): Promise<Doc<T> | null> {
  if (!reads) return ctx.db.get(id);
  if (!reads.rows.has(id)) reads.rows.set(id, ctx.db.get(id as Id<TableNames>));
  return reads.rows.get(id)! as Promise<Doc<T> | null>;
}
async function feedbackProof(
  ctx: QueryCtx,
  row: Doc<"contentFeedback">,
  reads?: Reads,
  w?: MaterialWalk,
) {
  if (!reads) return evidence(ctx, row, w);
  const cached = reads.feedback.get(row._id);
  if (cached) {
    const proof = await cached;
    if (!proof.recursive) return proof;
  }
  const proof = await evidence(ctx, row, w);
  // Only terminal human feedback can be reused outside the shared ancestry walk.
  if (!proof.recursive) reads.feedback.set(row._id, Promise.resolve(proof));
  return proof;
}
async function account(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  acc: Id<"socialAccounts">,
  reads?: Reads,
) {
  requireActiveWorkspace(await read(ctx, ws, reads));
  requireReference(ws, await read(ctx, acc, reads));
}
async function authorized(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  actor: Id<"users">,
  reads?: Reads,
) {
  if (reads) {
    const key = `${ws}:${actor}`;
    if (!reads.authorities.has(key))
      reads.authorities.set(key, authorized(ctx, ws, actor));
    return reads.authorities.get(key)!;
  }
  const m = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", actor).eq("workspaceId", ws),
    )
    .unique();
  if (!(await ctx.db.get(actor)) || !m || !["Owner", "Admin"].includes(m.role))
    throw new ConvexError("STYLE_CURRENT_AUTHORITY_REQUIRED");
}
async function control(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  acc: Id<"socialAccounts">,
) {
  return ctx.db
    .query("styleProfileControls")
    .withIndex("by_workspaceId_and_accountId", (q) =>
      q.eq("workspaceId", ws).eq("accountId", acc),
    )
    .unique();
}
type Walk = MaterialWalk & { eligible?: boolean; reads?: Reads };
const walk = (eligible = false, remaining = 32, reads?: Reads): Walk => ({
  ...materialWalk(remaining),
  eligible,
  reads,
});
function enter(w: Walk, id: string) {
  enterMaterial(w, id, "STYLE_ANCESTRY_LIMIT");
}
async function scoped<
  T extends
    "styleProfileVersions" | "learningProposals" | "styleProfileCommands",
>(
  ctx: QueryCtx,
  id: Id<T>,
  ws: Id<"workspaces">,
  acc: Id<"socialAccounts">,
  reads?: Reads,
) {
  const row = await read(ctx, id, reads);
  if (!row || row.workspaceId !== ws || row.accountId !== acc)
    throw new ConvexError("STYLE_REFERENCE_ACCESS_DENIED");
  return row;
}
export async function versionProof(
  ctx: QueryCtx,
  version: Doc<"styleProfileVersions">,
  w: Walk = walk(),
): Promise<number | null> {
  const memo = `${version._id}:${!!w.eligible}`;
  if (w.active.has(version._id)) throw new ConvexError("STYLE_ANCESTRY_LIMIT");
  if (w.done.has(memo)) return w.done.get(memo)!;
  enter(w, version._id);
  try {
    await account(ctx, version.workspaceId, version.accountId, w.reads);
    await authorized(ctx, version.workspaceId, version.createdBy, w.reads);
    await authorized(ctx, version.workspaceId, version.declaredBy, w.reads);
    if (
      !version.payload ||
      version.sourceUnavailable ||
      version.status === "erased" ||
      (w.eligible && version.status !== "active") ||
      version.fingerprint !==
        (await sha256(JSON.stringify(validate(version.payload))))
    )
      throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
    let until: number | null = operationalUntil(
      version.createdAt,
      version.sourceUntil,
    );
    if (version.baseVersionId) {
      const base = await scoped(
        ctx,
        version.baseVersionId,
        version.workspaceId,
        version.accountId,
        w.reads,
      );
      if (
        version.declaredBy !== base.declaredBy ||
        version.declaredAt !== base.declaredAt ||
        version.payload.author !== base.payload?.author ||
        JSON.stringify(version.payload.experiences) !==
          JSON.stringify(base.payload?.experiences)
      )
        throw new ConvexError("STYLE_DECLARATION_CHANGED");
      until = minimum(until, await versionProof(ctx, base, w));
    }
    if (version.proposalId) {
      const p = await scoped(
        ctx,
        version.proposalId,
        version.workspaceId,
        version.accountId,
        w.reads,
      );
      if (
        p.state !== "accepted" ||
        p.resultVersionId !== version._id ||
        p.baseVersionId !== version.baseVersionId ||
        p.decidedBy !== version.createdBy ||
        !p.preferences ||
        JSON.stringify(canonical(p.preferences)) !==
          JSON.stringify(
            canonical({
              tone: version.payload.tone,
              positioning: version.payload.positioning,
              pillars: version.payload.pillars,
              examples: version.payload.examples,
              forbidden: version.payload.forbidden,
            }),
          )
      )
        throw new ConvexError("STYLE_PROPOSAL_CHANGED");
      until = minimum(until, await proposalProof(ctx, p, w));
    }
    until = minimum(until);
    w.done.set(memo, until);
    return until;
  } finally {
    w.active.delete(version._id);
  }
}
export async function proposalProof(
  ctx: QueryCtx,
  p: Doc<"learningProposals">,
  w: Walk = walk(),
): Promise<number | null> {
  const memo = `${p._id}:${!!w.eligible}`;
  if (w.active.has(p._id)) throw new ConvexError("STYLE_ANCESTRY_LIMIT");
  if (w.done.has(memo)) return w.done.get(memo)!;
  enter(w, p._id);
  try {
    await account(ctx, p.workspaceId, p.accountId, w.reads);
    await authorized(ctx, p.workspaceId, p.createdBy, w.reads);
    if (p.decidedBy) await authorized(ctx, p.workspaceId, p.decidedBy, w.reads);
    if (p.sourceUnavailable || !p.preferences)
      throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
    const base = await scoped(
      ctx,
      p.baseVersionId,
      p.workspaceId,
      p.accountId,
      w.reads,
    );
    if (base.fingerprint !== p.baseFingerprint)
      throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
    const selection = await scoped(
      ctx,
      p.baseSelectionReceiptId,
      p.workspaceId,
      p.accountId,
      w.reads,
    );
    await authorized(ctx, p.workspaceId, selection.actorId, w.reads);
    if (
      selection.sourceUnavailable ||
      !["select", "rollback"].includes(selection.action) ||
      selection.versionId !== p.baseVersionId
    )
      throw new ConvexError("STYLE_SELECTION_CHANGED");
    const baseUntil = await versionProof(ctx, base, w);
    const f = await read(ctx, p.feedbackId, w.reads);
    if (
      !f ||
      f.workspaceId !== p.workspaceId ||
      f.accountId !== p.accountId ||
      f.versionId !== p.beforeVersionId ||
      f.resultingVersionId !== p.resultingVersionId
    )
      throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
    const proof = await feedbackProof(ctx, f, w.reads, w);
    if (proof.ver.draftId !== p.draftId)
      throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
    const until = minimum(
      operationalUntil(p.createdAt, p.sourceUntil),
      p.beforeUntil,
      p.resultUntil,
      baseUntil,
      proof.sourceUntil,
      proof.beforeUntil,
      proof.resultUntil,
    );
    w.done.set(memo, until);
    return until;
  } finally {
    w.active.delete(p._id);
  }
}
async function selectedProof(
  ctx: QueryCtx,
  c: Doc<"styleProfileControls">,
  reads?: Reads,
) {
  if (!c.selectedVersionId || !c.selectedBy || !c.selectionReceiptId)
    throw new ConvexError("STYLE_SELECTION_REQUIRED");
  await authorized(ctx, c.workspaceId, c.selectedBy, reads);
  const r = await scoped(
    ctx,
    c.selectionReceiptId,
    c.workspaceId,
    c.accountId,
    reads,
  );
  if (
    !["select", "rollback"].includes(r.action) ||
    r.versionId !== c.selectedVersionId ||
    r.actorId !== c.selectedBy ||
    r.sourceUnavailable
  )
    throw new ConvexError("STYLE_SELECTION_CHANGED");
  const version = await scoped(
    ctx,
    c.selectedVersionId,
    c.workspaceId,
    c.accountId,
    reads,
  );
  return {
    version,
    sourceUntil: await versionProof(ctx, version, walk(true, 32, reads)),
  };
}
export const change = workspaceMutation({
  args: {
    accountId: v.id("socialAccounts"),
    expectedRevision: v.number(),
    commandKey: v.string(),
    action,
  },
  returns: result,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    await account(ctx, ctx.workspace._id, a.accountId);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(a.commandKey))
      throw new ConvexError("STYLE_COMMAND_INVALID");
    text(a.action.reason, 1000, true);
    const x = a.action;
    const normalized =
      x.kind === "save"
        ? { ...x, payload: validate(x.payload) }
        : x.kind === "propose"
          ? {
              ...x,
              preferences: (() => {
                const p = validate({
                  author: "",
                  experiences: [],
                  ...x.preferences,
                });
                const { author, experiences, ...prefs } = p;
                return prefs;
              })(),
            }
          : x;
    const fingerprint = await sha256(
      JSON.stringify(canonical([a.accountId, a.expectedRevision, normalized])),
    );
    const old = await ctx.db
      .query("styleProfileCommands")
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
    if (old && old.fingerprint !== fingerprint)
      throw new ConvexError("STYLE_OPERATION_CONFLICT");
    const current = await control(ctx, ctx.workspace._id, a.accountId);
    let versionId: Id<"styleProfileVersions"> | null = null,
      proposalId: Id<"learningProposals"> | null = null;
    let base: Doc<"styleProfileVersions"> | null = null,
      p: Doc<"learningProposals"> | null = null,
      target: Doc<"styleProfileVersions"> | null = null;
    if ("baseVersionId" in x && x.baseVersionId) {
      base = await scoped(ctx, x.baseVersionId, ctx.workspace._id, a.accountId);
      await versionProof(ctx, base, walk(!old));
    }
    if ("proposalId" in x) {
      p = await scoped(ctx, x.proposalId, ctx.workspace._id, a.accountId);
      await proposalProof(ctx, p, walk(!old));
      proposalId = p._id;
    }
    if ("versionId" in x) {
      target = await scoped(ctx, x.versionId, ctx.workspace._id, a.accountId);
      await versionProof(ctx, target, walk(!old));
      versionId = target._id;
    }
    if (x.kind === "rollback") {
      const receipt = await scoped(
        ctx,
        x.receiptId,
        ctx.workspace._id,
        a.accountId,
      );
      if (
        !["select", "rollback"].includes(receipt.action) ||
        !receipt.versionId ||
        receipt.sourceUnavailable
      )
        throw new ConvexError("STYLE_ROLLBACK_TARGET_INVALID");
      await authorized(ctx, ctx.workspace._id, receipt.actorId);
      target = await scoped(
        ctx,
        receipt.versionId,
        ctx.workspace._id,
        a.accountId,
      );
      await versionProof(ctx, target, walk(!old));
      versionId = target._id;
    }
    if (old) {
      if (old.versionId)
        await versionProof(
          ctx,
          await scoped(ctx, old.versionId, ctx.workspace._id, a.accountId),
        );
      if (old.proposalId)
        await proposalProof(
          ctx,
          await scoped(ctx, old.proposalId, ctx.workspace._id, a.accountId),
        );
      return {
        revision: old.revision,
        versionId: old.versionId,
        proposalId: old.proposalId,
        receiptId: old._id,
      };
    }
    if (
      !Number.isSafeInteger(a.expectedRevision) ||
      a.expectedRevision !== (current?.revision ?? 0)
    )
      throw new ConvexError("STYLE_REVISION_CONFLICT");
    const now = Date.now();
    if (x.kind === "save") {
      if (x.freshDeclaration !== (x.baseVersionId === null))
        throw new ConvexError("STYLE_FRESH_DECLARATION_REQUIRED");
      const value = validate(x.payload);
      if (
        base &&
        (value.author !== base.payload!.author ||
          JSON.stringify(value.experiences) !==
            JSON.stringify(base.payload!.experiences))
      )
        throw new ConvexError("STYLE_FRESH_DECLARATION_REQUIRED");
      versionId = await ctx.db.insert("styleProfileVersions", {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        createdBy: ctx.user._id,
        createdAt: now,
        declaredBy: base?.declaredBy ?? ctx.user._id,
        declaredAt: base?.declaredAt ?? now,
        selfDeclaration: true,
        payload: value,
        fingerprint: await sha256(JSON.stringify(value)),
        baseVersionId: base?._id ?? null,
        proposalId: null,
        sourceUntil: base
          ? await versionProof(ctx, base, walk(true, 31))
          : null,
        sourceUnavailable: false,
        status: "active",
        reason: x.reason,
      });
    } else if (x.kind === "propose") {
      if (!current || current.selectedVersionId !== base!._id)
        throw new ConvexError("STYLE_BASE_CHANGED");
      await selectedProof(ctx, current);
      const feedback = await ctx.db.get(x.feedbackId);
      if (
        !feedback ||
        feedback.workspaceId !== ctx.workspace._id ||
        feedback.accountId !== a.accountId
      )
        throw new ConvexError("STYLE_REFERENCE_ACCESS_DENIED");
      const ancestry = walk(true, 31);
      const proof = await evidence(ctx, feedback, ancestry);
      if (x.preferences.examples.length && !x.ownExamples)
        throw new ConvexError("STYLE_OWN_EXAMPLES_REQUIRED");
      const { author, experiences, ...prefs } = validate({
        author: base!.payload!.author,
        experiences: base!.payload!.experiences,
        ...x.preferences,
      });
      proposalId = await ctx.db.insert("learningProposals", {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        createdBy: ctx.user._id,
        createdAt: now,
        baseVersionId: base!._id,
        baseFingerprint: base!.fingerprint,
        baseSelectionReceiptId: current.selectionReceiptId!,
        feedbackId: feedback._id,
        draftId: proof.ver.draftId,
        beforeVersionId: proof.ver._id,
        resultingVersionId: proof.result?._id ?? null,
        beforeUntil: proof.beforeUntil,
        resultUntil: proof.resultUntil,
        sourceUntil: minimum(
          proof.sourceUntil,
          await versionProof(ctx, base!, ancestry),
        ),
        preferences: prefs,
        ownExamples: x.ownExamples,
        reason: x.reason,
        state: "pending",
        decidedBy: null,
        decidedAt: null,
        decisionReason: "",
        resultVersionId: null,
        sourceUnavailable: false,
      });
    } else if (x.kind === "accept" || x.kind === "reject") {
      if (p!.state !== "pending")
        throw new ConvexError("STYLE_PROPOSAL_DECIDED");
      if (x.kind === "accept") {
        if (!current || current.selectedVersionId !== p!.baseVersionId)
          throw new ConvexError("STYLE_BASE_CHANGED");
        const selected = await selectedProof(ctx, current);
        const value = validate({
          ...selected.version.payload!,
          ...p!.preferences!,
        });
        versionId = await ctx.db.insert("styleProfileVersions", {
          workspaceId: ctx.workspace._id,
          accountId: a.accountId,
          createdBy: ctx.user._id,
          createdAt: now,
          declaredBy: selected.version.declaredBy,
          declaredAt: selected.version.declaredAt,
          selfDeclaration: true,
          payload: value,
          fingerprint: await sha256(JSON.stringify(value)),
          baseVersionId: selected.version._id,
          proposalId: p!._id,
          sourceUntil: await proposalProof(ctx, p!, walk(true, 31)),
          sourceUnavailable: false,
          status: "active",
          reason: x.reason,
        });
      }
      await ctx.db.patch(p!._id, {
        state: x.kind === "accept" ? "accepted" : "rejected",
        decidedBy: ctx.user._id,
        decidedAt: now,
        decisionReason: x.reason,
        resultVersionId: versionId,
      });
    } else if (x.kind === "retire")
      await ctx.db.patch(target!._id, { status: "retired" });
    if (x.kind === "reset") versionId = current?.selectedVersionId ?? null;
    const revision = (current?.revision ?? 0) + 1;
    const receiptId = await ctx.db.insert("styleProfileCommands", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      revision,
      action: x.kind,
      reason: x.reason,
      versionId,
      proposalId,
      createdAt: now,
      sourceUnavailable: false,
    });
    const selecting = x.kind === "select" || x.kind === "rollback",
      clearing =
        x.kind === "reset" ||
        (x.kind === "retire" && current?.selectedVersionId === versionId);
    const patch = {
      revision,
      selectedVersionId: selecting
        ? versionId
        : clearing
          ? null
          : (current?.selectedVersionId ?? null),
      selectedBy: selecting
        ? ctx.user._id
        : clearing
          ? null
          : (current?.selectedBy ?? null),
      selectionReceiptId: selecting
        ? receiptId
        : clearing
          ? null
          : (current?.selectionReceiptId ?? null),
      updatedAt: now,
    };
    if (current) await ctx.db.patch(current._id, patch);
    else
      await ctx.db.insert("styleProfileControls", {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        ...patch,
      });
    if (selecting || clearing)
      await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
        workspaceId: ctx.workspace._id,
        accountId: a.accountId,
        cursor: null,
        force: false,
      });
    return { revision, versionId, proposalId, receiptId };
  },
});
async function projectVersion(
  ctx: QueryCtx,
  row: Doc<"styleProfileVersions">,
  reads?: Reads,
) {
  try {
    return {
      ...row,
      sourceUntil: await versionProof(ctx, row, walk(false, 32, reads)),
    };
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    return { ...row, payload: null, reason: "", sourceUnavailable: true };
  }
}
async function projectProposal(
  ctx: QueryCtx,
  row: Doc<"learningProposals">,
  reads?: Reads,
) {
  try {
    return {
      ...row,
      sourceUntil: await proposalProof(ctx, row, walk(false, 32, reads)),
    };
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    return {
      ...row,
      preferences: null,
      reason: "",
      decisionReason: "",
      sourceUnavailable: true,
    };
  }
}
export async function commandProof(
  ctx: QueryCtx,
  row: Doc<"styleProfileCommands">,
  reads?: Reads,
) {
  const w = walk(false, 32, reads),
    horizons: (number | null)[] = [];
  if (row.sourceUnavailable || operationalUntil(row.createdAt) <= Date.now())
    throw new ConvexError("STYLE_SOURCE_UNAVAILABLE");
  await account(ctx, row.workspaceId, row.accountId, reads);
  await authorized(ctx, row.workspaceId, row.actorId, reads);
  if (row.versionId)
    horizons.push(
      await versionProof(
        ctx,
        await scoped(ctx, row.versionId, row.workspaceId, row.accountId, reads),
        w,
      ),
    );
  if (row.proposalId)
    horizons.push(
      await proposalProof(
        ctx,
        await scoped(
          ctx,
          row.proposalId,
          row.workspaceId,
          row.accountId,
          reads,
        ),
        w,
      ),
    );
  return minimum(...horizons);
}
async function projectCommand(
  ctx: QueryCtx,
  row: Doc<"styleProfileCommands">,
  reads?: Reads,
) {
  try {
    await commandProof(ctx, row, reads);
    return row;
  } catch (error) {
    rethrowUnexpectedSourceError(error);
    return { ...row, reason: "", sourceUnavailable: true };
  }
}
export const get = workspaceQuery({
  args: { accountId: v.id("socialAccounts") },
  returns: v.object({
    control: v.union(controlDoc, v.null()),
    versions: v.array(versionCatalog),
    proposals: v.array(proposalCatalog),
    usable: v.boolean(),
  }),
  handler: async (ctx, a) => {
    const reads = reading();
    await account(ctx, ctx.workspace._id, a.accountId, reads);
    const current = await control(ctx, ctx.workspace._id, a.accountId);
    // ponytail: latest 25 versions/proposals; exact selected IDs and paged decisions preserve older history.
    const versions = await ctx.db
      .query("styleProfileVersions")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .order("desc")
      .take(25);
    if (
      current?.selectedVersionId &&
      !versions.some((x) => x._id === current.selectedVersionId)
    )
      versions.push(
        await scoped(
          ctx,
          current.selectedVersionId,
          ctx.workspace._id,
          a.accountId,
          reads,
        ),
      );
    const proposals = await ctx.db
      .query("learningProposals")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .order("desc")
      .take(25);
    let usable = false;
    if (current?.selectedVersionId)
      try {
        await selectedProof(ctx, current, reads);
        usable = true;
      } catch (error) {
        rethrowUnexpectedSourceError(error);
        /* explicit unavailable selection */
      }
    return {
      control: current,
      versions: versions.map(
        ({
          _id,
          _creationTime,
          status,
          declaredBy,
          declaredAt,
          createdBy,
          createdAt,
        }) => ({
          _id,
          _creationTime,
          status,
          declaredBy,
          declaredAt,
          createdBy,
          createdAt,
        }),
      ),
      proposals: proposals.map(({ _id, state }) => ({ _id, state })),
      usable,
    };
  },
});
export const version = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    versionId: v.id("styleProfileVersions"),
  },
  returns: versionDoc,
  handler: async (ctx, a) => {
    const reads = reading();
    await account(ctx, ctx.workspace._id, a.accountId, reads);
    return projectVersion(
      ctx,
      await scoped(ctx, a.versionId, ctx.workspace._id, a.accountId, reads),
      reads,
    );
  },
});
export const proposal = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    proposalId: v.id("learningProposals"),
  },
  returns: proposalDoc,
  handler: async (ctx, a) => {
    const reads = reading();
    await account(ctx, ctx.workspace._id, a.accountId, reads);
    return projectProposal(
      ctx,
      await scoped(ctx, a.proposalId, ctx.workspace._id, a.accountId, reads),
      reads,
    );
  },
});
export const receipt = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    receiptId: v.id("styleProfileCommands"),
  },
  returns: commandDoc,
  handler: async (ctx, a) => {
    const reads = reading();
    await account(ctx, ctx.workspace._id, a.accountId, reads);
    return projectCommand(
      ctx,
      await scoped(ctx, a.receiptId, ctx.workspace._id, a.accountId, reads),
      reads,
    );
  },
});
export const inspect = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    proposalId: v.id("learningProposals"),
  },
  returns: v.object({
    proposal: proposalDoc,
    base: versionDoc,
    before: v.union(v.string(), v.null()),
    after: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, a) => {
    const reads = reading();
    await account(ctx, ctx.workspace._id, a.accountId, reads);
    const p = await scoped(
        ctx,
        a.proposalId,
        ctx.workspace._id,
        a.accountId,
        reads,
      ),
      proposal = await projectProposal(ctx, p, reads),
      base = await projectVersion(
        ctx,
        await scoped(
          ctx,
          p.baseVersionId,
          ctx.workspace._id,
          a.accountId,
          reads,
        ),
        reads,
      );
    let before: string | null = null,
      after: string | null = null;
    if (!proposal.sourceUnavailable) {
      const proof = await feedbackProof(
        ctx,
        (await read(ctx, p.feedbackId, reads))!,
        reads,
      );
      before = (await projectDraft(ctx, proof.ver)).content.text
        .join("\n")
        .slice(0, 4000);
      after = proof.result
        ? (await projectDraft(ctx, proof.result)).content.text
            .join("\n")
            .slice(0, 4000)
        : null;
    }
    return { proposal, base, before, after };
  },
});
export const history = workspaceQuery({
  args: {
    accountId: v.id("socialAccounts"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(commandCatalog),
    isDone: v.boolean(),
    continueCursor: v.string(),
  }),
  handler: async (ctx, a) => {
    const reads = reading();
    await account(ctx, ctx.workspace._id, a.accountId, reads);
    if (
      !Number.isSafeInteger(a.paginationOpts.numItems) ||
      a.paginationOpts.numItems < 1 ||
      a.paginationOpts.numItems > 25
    )
      throw new ConvexError("STYLE_PAGE_LIMIT");
    const p = await ctx.db
      .query("styleProfileCommands")
      .withIndex("by_workspaceId_and_accountId", (q) =>
        q.eq("workspaceId", ctx.workspace._id).eq("accountId", a.accountId),
      )
      .order("desc")
      .paginate(a.paginationOpts);
    return {
      page: p.page.map(
        ({
          _id,
          _creationTime,
          revision,
          action,
          versionId,
          proposalId,
          createdAt,
        }) => ({
          _id,
          _creationTime,
          revision,
          action,
          versionId,
          proposalId,
          createdAt,
        }),
      ),
      isDone: p.isDone,
      continueCursor: p.continueCursor,
    };
  },
});
async function eraseVersion(
  ctx: MutationCtx,
  row: Doc<"styleProfileVersions">,
) {
  if (!row.sourceUnavailable)
    await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
      styleVersionId: row._id,
      cursor: null,
      force: true,
    });
  if (!row.sourceUnavailable)
    await ctx.scheduler.runAfter(0, internal.planning.recurring.purgeStyle, {
      versionId: row._id,
      cursor: null,
    });
  if (!row.sourceUnavailable)
    await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purgeRuns, {
      versionId: row._id,
      cursor: null,
    });
  if (!row.sourceUnavailable)
    await ctx.scheduler.runAfter(
      0,
      internal.performance.experiments.purgeStyle,
      { versionId: row._id },
    );
  await ctx.db.patch(row._id, {
    payload: null,
    reason: "",
    sourceUnavailable: true,
    status: "erased",
  });
  const c = await control(ctx, row.workspaceId, row.accountId);
  if (c?.selectedVersionId === row._id)
    await ctx.db.patch(c._id, {
      selectedVersionId: null,
      selectedBy: null,
      selectionReceiptId: null,
      revision: c.revision + 1,
      updatedAt: Date.now(),
    });
}
async function eraseProposal(ctx: MutationCtx, row: Doc<"learningProposals">) {
  await ctx.db.patch(row._id, {
    preferences: null,
    reason: "",
    decisionReason: "",
    sourceUnavailable: true,
  });
}
export const purge = internalMutation({
  args: {
    versionId: v.union(v.id("styleProfileVersions"), v.null()),
    proposalId: v.union(v.id("learningProposals"), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (Boolean(a.versionId) === Boolean(a.proposalId))
      throw new ConvexError("STYLE_CLEANUP_TARGET_INVALID");
    const version = a.versionId ? await ctx.db.get(a.versionId) : null,
      proposal = a.proposalId ? await ctx.db.get(a.proposalId) : null;
    if (!version && !proposal) return null;
    if (version) await eraseVersion(ctx, version);
    if (proposal) await eraseProposal(ctx, proposal);
    let more = false;
    const versions = version
      ? await ctx.db
          .query("styleProfileVersions")
          .withIndex("by_baseVersionId_and_sourceUnavailable", (q) =>
            q.eq("baseVersionId", version._id).eq("sourceUnavailable", false),
          )
          .take(25)
      : await ctx.db
          .query("styleProfileVersions")
          .withIndex("by_proposalId_and_sourceUnavailable", (q) =>
            q.eq("proposalId", proposal!._id).eq("sourceUnavailable", false),
          )
          .take(25);
    for (const row of versions) {
      await eraseVersion(ctx, row);
      await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purge, {
        versionId: row._id,
        proposalId: null,
      });
    }
    more ||= versions.length === 25;
    if (version) {
      const proposals = await ctx.db
        .query("learningProposals")
        .withIndex("by_baseVersionId_and_sourceUnavailable", (q) =>
          q.eq("baseVersionId", version._id).eq("sourceUnavailable", false),
        )
        .take(25);
      for (const row of proposals) {
        await eraseProposal(ctx, row);
        await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purge, {
          versionId: null,
          proposalId: row._id,
        });
      }
      more ||= proposals.length === 25;
    }
    const commands = version
      ? await ctx.db
          .query("styleProfileCommands")
          .withIndex("by_versionId_and_sourceUnavailable", (q) =>
            q.eq("versionId", version._id).eq("sourceUnavailable", false),
          )
          .take(25)
      : await ctx.db
          .query("styleProfileCommands")
          .withIndex("by_proposalId_and_sourceUnavailable", (q) =>
            q.eq("proposalId", proposal!._id).eq("sourceUnavailable", false),
          )
          .take(25);
    for (const r of commands)
      await ctx.db.patch(r._id, { reason: "", sourceUnavailable: true });
    more ||= commands.length === 25;
    if (more)
      await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purge, a);
    return null;
  },
});
export const purgeFeedback = internalMutation({
  args: { feedbackId: v.id("contentFeedback") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const row = await ctx.db.get(a.feedbackId);
    if (row)
      try {
        await evidence(ctx, row);
        return null;
      } catch (error) {
        rethrowUnexpectedSourceError(error);
        /* invalid before or result */
      }
    const rows = await ctx.db
      .query("learningProposals")
      .withIndex("by_feedbackId_and_sourceUnavailable", (q) =>
        q.eq("feedbackId", a.feedbackId).eq("sourceUnavailable", false),
      )
      .take(25);
    for (const p of rows) {
      await eraseProposal(ctx, p);
      await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purge, {
        versionId: null,
        proposalId: p._id,
      });
    }
    if (rows.length === 25)
      await ctx.scheduler.runAfter(
        0,
        internal.ai.styleProfiles.purgeFeedback,
        a,
      );
    return null;
  },
});
export const sweep = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    table: v.union(
      v.literal("proposals"),
      v.literal("versions"),
      v.literal("commands"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.table === "proposals") {
      const batch = await ctx.db
        .query("learningProposals")
        .withIndex("by_sourceUnavailable", (q) =>
          q.eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor, numItems: 1 });
      for (const p of batch.page)
        try {
          await proposalProof(ctx, p);
        } catch (error) {
          rethrowUnexpectedSourceError(error);
          await eraseProposal(ctx, p);
          await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purge, {
            versionId: null,
            proposalId: p._id,
          });
        }
      await ctx.scheduler.runAfter(
        0,
        internal.ai.styleProfiles.sweep,
        batch.isDone
          ? { cursor: null, table: "versions" }
          : { cursor: batch.continueCursor, table: "proposals" },
      );
    } else if (a.table === "versions") {
      const batch = await ctx.db
        .query("styleProfileVersions")
        .withIndex("by_sourceUnavailable", (q) =>
          q.eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor, numItems: 1 });
      for (const r of batch.page)
        try {
          await versionProof(ctx, r);
          const run = await ctx.db
            .query("agentRuns")
            .withIndex("by_styleContext_versionId", (q) =>
              q.eq("styleContext.versionId", r._id),
            )
            .first();
          if (run)
            await ctx.scheduler.runAfter(
              0,
              internal.ai.styleProfiles.sweepRuns,
              { versionId: r._id, cursor: null },
            );
        } catch (error) {
          rethrowUnexpectedSourceError(error);
          await eraseVersion(ctx, r);
          await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purge, {
            versionId: r._id,
            proposalId: null,
          });
        }
      await ctx.scheduler.runAfter(
        0,
        internal.ai.styleProfiles.sweep,
        batch.isDone
          ? { cursor: null, table: "commands" }
          : { cursor: batch.continueCursor, table: "versions" },
      );
    } else {
      const batch = await ctx.db
        .query("styleProfileCommands")
        .withIndex("by_sourceUnavailable", (q) =>
          q.eq("sourceUnavailable", false),
        )
        .paginate({ cursor: a.cursor, numItems: 1 });
      for (const row of batch.page)
        if ((await projectCommand(ctx, row)).sourceUnavailable)
          await ctx.db.patch(row._id, { reason: "", sourceUnavailable: true });
      if (!batch.isDone)
        await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.sweep, {
          cursor: batch.continueCursor,
          table: "commands",
        });
    }
    return null;
  },
});

// Server-only pin. Selection revision changes unrelated to selection never recapture a run.
export async function captureStyle(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  acc: Id<"socialAccounts">,
) {
  const c = await control(ctx, ws, acc);
  if (!c?.selectedVersionId) return undefined;
  const { version, sourceUntil } = await selectedProof(ctx, c);
  return {
    versionId: version._id,
    fingerprint: version.fingerprint,
    selectedBy: c.selectedBy!,
    selectionReceiptId: c.selectionReceiptId!,
    sourceUntil,
  };
}
export async function runStyleProof(
  ctx: QueryCtx,
  r: Doc<"agentRuns">,
  current = false,
  w: MaterialWalk = materialWalk(),
) {
  if (!r.styleContext) return { payload: null, sourceUntil: null };
  return scopedStyleProof(ctx, r, r.styleContext, current, w);
}
export async function scopedStyleProof(
  ctx: QueryCtx,
  r: { workspaceId: Id<"workspaces">; accountId: Id<"socialAccounts"> },
  pin: NonNullable<Doc<"agentRuns">["styleContext"]>,
  current = false,
  w: MaterialWalk = materialWalk(),
) {
  await authorized(ctx, r.workspaceId, pin.selectedBy);
  const receipt = await scoped(
    ctx,
    pin.selectionReceiptId,
    r.workspaceId,
    r.accountId,
  );
  const version = await scoped(ctx, pin.versionId, r.workspaceId, r.accountId);
  if (
    receipt.sourceUnavailable ||
    !["select", "rollback"].includes(receipt.action) ||
    receipt.versionId !== pin.versionId ||
    receipt.actorId !== pin.selectedBy ||
    version.fingerprint !== pin.fingerprint
  )
    throw new ConvexError("STYLE_SELECTION_CHANGED");
  if (current) {
    const c = await control(ctx, r.workspaceId, r.accountId);
    if (
      c?.selectedVersionId !== pin.versionId ||
      c.selectedBy !== pin.selectedBy ||
      c.selectionReceiptId !== pin.selectionReceiptId
    )
      throw new ConvexError("STYLE_SELECTION_CHANGED");
  }
  const sourceUntil = minimum(
    pin.sourceUntil,
    await versionProof(ctx, version, { ...w, eligible: current }),
  );
  return { payload: version.payload!, sourceUntil };
}
export const purgeRuns = internalMutation({
  args: {
    versionId: v.id("styleProfileVersions"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.cursor === null)
      await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
        styleVersionId: a.versionId,
        cursor: null,
        force: false,
      });
    const page = await ctx.db
      .query("agentRuns")
      .withIndex("by_styleContext_versionId", (q) =>
        q.eq("styleContext.versionId", a.versionId),
      )
      .paginate({ numItems: 25, cursor: a.cursor });
    for (const r of page.page)
      await ctx.scheduler.runAfter(0, internal.ai.runs.purgeSource, {
        runId: r._id,
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.purgeRuns, {
        versionId: a.versionId,
        cursor: page.continueCursor,
      });
    return null;
  },
});

export const sweepRuns = internalMutation({
  args: {
    versionId: v.id("styleProfileVersions"),
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.cursor === null)
      await ctx.scheduler.runAfter(0, internal.ai.jev.routing.purge, {
        styleVersionId: a.versionId,
        cursor: null,
        force: false,
      });
    const page = await ctx.db
      .query("agentRuns")
      .withIndex("by_styleContext_versionId", (q) =>
        q.eq("styleContext.versionId", a.versionId),
      )
      .paginate({ numItems: 1, cursor: a.cursor });
    for (const r of page.page)
      await ctx.scheduler.runAfter(0, internal.ai.contentCopies.sweep, {
        runId: r._id,
        cursor: null,
        path: [],
      });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.ai.styleProfiles.sweepRuns, {
        versionId: a.versionId,
        cursor: page.continueCursor,
      });
    return null;
  },
});
