import { ConvexError, v, type Infer } from "convex/values";
import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { facts } from "./signalFields";
import { checkSource } from "./repositories";
import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { QueryCtx } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { barrierSequence, nextAdmissionSequence } from "./barriers";
export async function localEvidence(
  ctx: QueryCtx,
  workspaceId: Id<"workspaces">,
  guid: string,
) {
  const received = await ctx.db
    .query("githubDeliveryGuids")
    .withIndex("by_guid", (q) => q.eq("guid", guid))
    .unique();
  const receipt = received ? await ctx.db.get(received.receiptId) : null;
  const signal = receipt
    ? await ctx.db
        .query("githubSignals")
        .withIndex("by_workspaceId_and_eventKey", (q) =>
          q.eq("workspaceId", workspaceId).eq("eventKey", receipt.eventKey),
        )
        .unique()
    : null;
  return { receipt, signal };
}

async function closeRepository(
  ctx: MutationCtx,
  r: Doc<"githubRepositories">,
  sequence: number,
) {
  if (
    (r.verifiedSequence ?? 0) >= sequence ||
    (!r.access &&
      !r.monitoring &&
      !r.content &&
      !r.contextRead &&
      !r.proofExpiresAt)
  )
    return;
  await ctx.db.patch(r._id, {
    access: false,
    monitoring: false,
    content: false,
    contextRead: false,
    proofExpiresAt: 0,
    generation: r.generation + 1,
    updatedAt: Date.now(),
  });
}
// revoke_user fan-out checkpoint: the outer connection scan advances one
// connection per invocation (c always points between connections) while an
// in-progress connection is referenced by id with its own repository cursor.
// Stored in the existing receipt cursor string, so no schema change; a plain
// opaque cursor from before this change resumes as the outer scan position.
function decodeRevokeCursor(cursor: string | null): {
  c: string | null;
  conn: Id<"githubConnections"> | null;
  rc: string | null;
} {
  if (cursor)
    try {
      const o = JSON.parse(cursor) as {
        v?: unknown;
        c?: unknown;
        conn?: unknown;
        rc?: unknown;
      };
      if (typeof o === "object" && o !== null && o.v === 1)
        return {
          c: typeof o.c === "string" ? o.c : null,
          conn:
            typeof o.conn === "string"
              ? (o.conn as Id<"githubConnections">)
              : null,
          rc: typeof o.rc === "string" ? o.rc : null,
        };
    } catch {
      // Legacy opaque pagination cursor; resume the outer scan with it.
    }
  else return { c: null, conn: null, rc: null };
  return { c: cursor, conn: null, rc: null };
}
function encodeRevokeCursor(s: {
  c: string | null;
  conn: Id<"githubConnections"> | null;
  rc: string | null;
}): string {
  return JSON.stringify({ v: 1, c: s.c, conn: s.conn, rc: s.rc });
}
async function applyRevocation(
  ctx: MutationCtx,
  receiptId: Id<"githubWebhookReceipts">,
  f: Infer<typeof facts>,
) {
  const keys =
    f.kind === "revoke_user"
      ? [`user:${f.identity}`]
      : f.kind === "revoke_install" ||
          (f.kind === "revoke_repositories" && f.allRemoved)
        ? [`install:${f.installationId}`]
        : f.kind === "revoke_repositories"
          ? f.removed.map((id) => `repo:${f.installationId}:${id}`)
          : [];
  // The durable barrier is effective in every source guard before acknowledgement; no async revocation gap.
  const sequence = keys.length ? (await barrierSequence(ctx, ["*"])) + 1 : 0;
  // ponytail: one App-wide revocation fence, split by App only if multiple Apps are introduced. Normal Push/Release does not contend here.
  for (const key of keys.length ? ["*", ...keys] : []) {
    const row = await ctx.db
      .query("githubRevocationBarriers")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (row)
      await ctx.db.patch(row._id, {
        receivedAt: Date.now(),
        receiptId,
        sequence,
      });
    else
      await ctx.db.insert("githubRevocationBarriers", {
        key,
        receivedAt: Date.now(),
        receiptId,
        sequence,
      });
  }
  return sequence;
}
export const record = internalMutation({
  args: { guid: v.string(), digest: v.string(), facts },
  returns: v.id("githubWebhookReceipts"),
  handler: async (ctx, a) => {
    const oldGuid = await ctx.db
      .query("githubDeliveryGuids")
      .withIndex("by_guid", (q) => q.eq("guid", a.guid))
      .unique();
    if (oldGuid && oldGuid.digest !== a.digest)
      throw new ConvexError("GITHUB_DELIVERY_CONFLICT");
    const old = await ctx.db
      .query("githubWebhookReceipts")
      .withIndex("by_digest", (q) => q.eq("digest", a.digest))
      .unique();
    if (old) {
      if (JSON.stringify(old.facts) !== JSON.stringify(a.facts))
        throw new ConvexError("GITHUB_DELIVERY_CONFLICT");
      if (!oldGuid) {
        if (old.aliasCount >= 100 && !old.facts.kind.startsWith("revoke_"))
          throw new ConvexError("GITHUB_DELIVERY_CONFLICT");
        // ponytail: retain at most100 aliases perbody; unknown security aliases beyond this cap conservatively close authority again.
        if (old.aliasCount < 100)
          await ctx.db.insert("githubDeliveryGuids", {
            guid: a.guid,
            digest: a.digest,
            receiptId: old._id,
          });
        await ctx.db.patch(old._id, {
          aliasCount: Math.min(100, old.aliasCount + 1),
        });
        if (old.facts.kind.startsWith("revoke_")) {
          const sequence = await applyRevocation(ctx, old._id, old.facts);
          await ctx.db.patch(old._id, {
            revocationSequence: sequence,
            ambiguousRevocation: true,
            latestReceivedAt: Date.now(),
            state: "pending",
            cursor: null,
            dueAt: Date.now() + 60000,
          });
          await ctx.scheduler.runAfter(
            0,
            internal.integrations.github.deliveries.process,
            { receiptId: old._id },
          );
        }
      }
      if (old.state === "pending")
        await ctx.scheduler.runAfter(
          0,
          internal.integrations.github.deliveries.process,
          { receiptId: old._id },
        );
      return old._id;
    }
    const receivedAt = Date.now();
    const f = a.facts;
    const eventKey =
      f.kind === "push"
        ? JSON.stringify([
            f.kind,
            f.installationId,
            f.providerId,
            f.ref,
            f.before,
            f.after,
            f.created,
            f.deleted,
            f.forced,
          ])
        : f.kind === "release"
          ? JSON.stringify([
              f.kind,
              f.installationId,
              f.providerId,
              f.releaseId,
              f.providerAt,
            ])
          : a.digest;
    const factual = f.kind === "push" || f.kind === "release";
    const firstEvent = factual
      ? await ctx.db
          .query("githubWebhookReceipts")
          .withIndex("by_eventKey", (q) => q.eq("eventKey", eventKey))
          .first()
      : null;
    const admissionSequence = factual
      ? firstEvent
        ? firstEvent.admissionSequence
        : await nextAdmissionSequence(ctx)
      : undefined;
    const receiptId = await ctx.db.insert("githubWebhookReceipts", {
      ...a,
      eventKey,
      receivedAt,
      admissionSequence,
      latestReceivedAt: receivedAt,
      ambiguousRevocation: false,
      state: "pending",
      cursor: null,
      dueAt: receivedAt + 60000,
      processedCount: 0,
      blockedCount: 0,
      aliasCount: 1,
      revocationSequence: 0,
    });
    await ctx.db.insert("githubDeliveryGuids", {
      guid: a.guid,
      digest: a.digest,
      receiptId,
    });
    const sequence = await applyRevocation(ctx, receiptId, f);
    await ctx.db.patch(receiptId, { revocationSequence: sequence });
    await ctx.scheduler.runAfter(
      0,
      internal.integrations.github.deliveries.process,
      { receiptId },
    );
    return receiptId;
  },
});
export async function admitFact(
  ctx: MutationCtx,
  receipt: Doc<"githubWebhookReceipts">,
  source: Doc<"githubRepositories">,
  admission?: {
    actorId: Id<"users">;
    authorizedAt: number;
    recoveryId: Id<"githubRecoveries">;
  },
) {
  const f = receipt.facts;
  if (f.kind !== "push" && f.kind !== "release") return null;
  try {
    await checkSource(
      ctx,
      source.workspaceId,
      source._id,
      source.generation,
      "monitoring",
    );
  } catch {
    return null;
  }
  if (
    (!admission &&
      (source.purposeSequence === undefined ||
        receipt.admissionSequence === undefined ||
        source.purposeSequence >= receipt.admissionSequence)) ||
    source.providerId !== f.providerId ||
    source.installationId !== f.installationId ||
    source.private !== f.private ||
    source.fullName !== f.fullName
  )
    return null;
  const old = await ctx.db
    .query("githubSignals")
    .withIndex("by_workspaceId_and_eventKey", (q) =>
      q.eq("workspaceId", source.workspaceId).eq("eventKey", receipt.eventKey),
    )
    .unique();
  if (!old) {
    const url =
      f.kind === "release"
        ? `https://github.com/${f.fullName}/releases/tag/${encodeURIComponent(f.tag)}`
        : f.deleted || /^0+$/.test(f.after)
          ? null
          : `https://github.com/${f.fullName}/commit/${f.after}`;
    await ctx.db.insert("githubSignals", {
      workspaceId: source.workspaceId,
      repositoryId: source._id,
      generation: source.generation,
      receiptId: receipt._id,
      digest: receipt.digest,
      eventKey: receipt.eventKey,
      guid: receipt.guid,
      kind: f.kind,
      fullName: f.fullName,
      private: f.private,
      ref: f.ref,
      before: f.before,
      after: f.after,
      commitCount: f.commitCount,
      created: f.created,
      deleted: f.deleted,
      forced: f.forced,
      releaseId: f.releaseId,
      tag: f.tag,
      prerelease: f.prerelease,
      url,
      providerAt: f.providerAt,
      receivedAt: receipt.receivedAt,
      processedAt: Date.now(),
      explicitRecovery: admission,
    });
  }

  return !old;
}

export const process = internalMutation({
  args: { receiptId: v.id("githubWebhookReceipts") },
  returns: v.null(),
  handler: async (ctx, a) => {
    const r = await ctx.db.get(a.receiptId);
    if (!r || r.state === "processed") return null;
    const f = r.facts;
    let cursor: string | null,
      done: boolean,
      processedCount = r.processedCount,
      blockedCount = r.blockedCount;
    if (f.kind === "revoke_user") {
      // One paginated query per invocation (a Convex limit): outer-connection
      // steps and repository steps alternate. Each writes at most one
      // connection flag plus one 25-repository page. The durable barrier
      // already applied in record, so only flag cleanup is eventual here.
      const sub = decodeRevokeCursor(r.cursor);
      const needsWork = (c: Doc<"githubConnections">) =>
        (c.authorizedSequence ?? 0) < r.revocationSequence;
      const flagConnection = async (c: Doc<"githubConnections">) => {
        if (c.status !== "reauth_required" || c.envelope)
          await ctx.db.patch(c._id, {
            status: "reauth_required",
            envelope: undefined,
            leaseUntil: 0,
            generation: c.generation + 1,
            credentialGeneration: c.credentialGeneration + 1,
            errorCode: r.ambiguousRevocation
              ? "GITHUB_REVOCATION_RECHECK_REQUIRED"
              : "GITHUB_AUTHORIZATION_REVOKED",
            updatedAt: Date.now(),
          });
      };
      if (sub.conn) {
        const target = await ctx.db.get(sub.conn);
        if (target && target.identity === f.identity && needsWork(target)) {
          const repos = await ctx.db
            .query("githubRepositories")
            .withIndex("by_workspaceId_and_selected", (q) =>
              q.eq("workspaceId", target.workspaceId).eq("selected", true),
            )
            .paginate({ numItems: 25, cursor: sub.rc });
          for (const source of repos.page)
            await closeRepository(ctx, source, r.revocationSequence);
          if (repos.isDone) processedCount++;
          cursor = encodeRevokeCursor({
            c: sub.c,
            conn: repos.isDone ? null : target._id,
            rc: repos.isDone ? null : repos.continueCursor,
          });
        } else {
          // Closed, moved, or re-authorized since the checkpoint; resume the
          // outer scan, which already points past this connection.
          cursor = encodeRevokeCursor({ c: sub.c, conn: null, rc: null });
        }
        done = false;
      } else {
        const page = await ctx.db
          .query("githubConnections")
          .withIndex("by_identity", (q) => q.eq("identity", f.identity))
          .paginate({ numItems: 1, cursor: sub.c });
        const target = page.page[0];
        if (!target) {
          cursor = page.isDone
            ? null
            : encodeRevokeCursor({ c: sub.c, conn: null, rc: null });
          done = page.isDone;
        } else if (!needsWork(target)) {
          cursor = encodeRevokeCursor({
            c: page.continueCursor,
            conn: null,
            rc: null,
          });
          done = false;
        } else {
          await flagConnection(target);
          cursor = encodeRevokeCursor({
            c: page.continueCursor,
            conn: target._id,
            rc: null,
          });
          done = false;
        }
      }
    } else {
      const query =
        f.kind === "push" || f.kind === "release"
          ? ctx.db
              .query("githubRepositories")
              .withIndex("by_providerId_and_installationId_and_selected", (q) =>
                q
                  .eq("providerId", f.providerId)
                  .eq("installationId", f.installationId)
                  .eq("selected", true),
              )
          : ctx.db
              .query("githubRepositories")
              .withIndex("by_installationId_and_selected", (q) =>
                q.eq("installationId", f.installationId).eq("selected", true),
              );
      const page = await query.paginate({ numItems: 25, cursor: r.cursor });
      for (const source of page.page) {
        if (f.kind === "revoke_install" || f.kind === "revoke_repositories") {
          if (
            f.kind === "revoke_install" ||
            f.allRemoved ||
            f.removed.includes(source.providerId)
          ) {
            await closeRepository(ctx, source, r.revocationSequence);
            processedCount++;
          }
          continue;
        }
        const inserted = await admitFact(ctx, r, source);
        if (inserted === null) {
          blockedCount++;
          continue;
        }
        if (inserted) processedCount++;
        for (const guid of [r.guid]) {
          const recovery = await ctx.db
            .query("githubRecoveries")
            .withIndex("by_workspaceId_and_guid", (q) =>
              q.eq("workspaceId", source.workspaceId).eq("guid", guid),
            )
            .unique();
          if (recovery)
            await ctx.db.patch(recovery._id, {
              state: "processed",
              leaseUntil: 0,
              updatedAt: Date.now(),
              errorCode: null,
            });
        }
      }
      cursor = page.continueCursor;
      done = page.isDone;
    }
    // Signal writes and the fanout checkpoint share this transaction. A crashed invocation can safely repeat.
    await ctx.db.patch(r._id, {
      cursor: done ? null : cursor,
      state: done ? "processed" : "pending",
      dueAt: Date.now() + 60000,
      processedCount,
      blockedCount,
    });
    if (!done)
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.github.deliveries.process,
        a,
      );
    return null;
  },
});
export const resume = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    for (const r of await ctx.db
      .query("githubWebhookReceipts")
      .withIndex("by_state_and_dueAt", (q) =>
        q.eq("state", "pending").lte("dueAt", Date.now()),
      )
      .take(20)) {
      await ctx.scheduler.runAfter(
        0,
        internal.integrations.github.deliveries.process,
        { receiptId: r._id },
      );
      await ctx.db.patch(r._id, { dueAt: Date.now() + 60000 });
    }
    return null;
  },
});
