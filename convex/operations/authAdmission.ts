import { createFunctionHandle } from "convex/server";
import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
const revision = "dispatch-admission-v1";
const pendingLifetime = 120_000;
const guardArgs = {
  model: v.string(),
  operation: v.union(
    v.literal("create"),
    v.literal("update"),
    v.literal("verificationDelete"),
  ),
  id: v.string(),
  fields: v.array(v.string()),
  previousOwner: v.optional(v.string()),
  approvalNonce: v.optional(v.string()),
};
export async function digest(value: string, keyValue?: string) {
  const secret = keyValue ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new ConvexError("AUTH_GUARD_SECRET_MISSING");
  const bytes = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    bytes.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, bytes.encode(value));
  return Array.from(new Uint8Array(signed), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export function canonicalWrite(
  model: string,
  operation: string,
  data: Record<string, unknown>,
) {
  const normalized = Object.keys(data)
    .filter(
      (key) =>
        !["_id", "_creationTime"].includes(key) && data[key] !== undefined,
    )
    .sort()
    .map((key) => {
      const value =
        data[key] instanceof Date ? (data[key] as Date).getTime() : data[key];
      if (
        value !== null &&
        !["string", "boolean", "number"].includes(typeof value)
      )
        throw new ConvexError("AUTH_WRITE_SHAPE_UNSUPPORTED");
      if (typeof value === "number" && !Number.isFinite(value))
        throw new ConvexError("AUTH_WRITE_SHAPE_UNSUPPORTED");
      return [key, value];
    });
  return JSON.stringify([model, operation, normalized]);
}
async function guardedDigest(ctx: MutationCtx | QueryCtx, value: string) {
  const key = await ctx.db.query("authGuardKey").unique();
  if (!key) throw new ConvexError("AUTH_GUARD_KEY_MISSING");
  return digest(value, key.key);
}
export const admissionKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    const key = await ctx.db.query("authGuardKey").unique();
    if (!key) throw new ConvexError("AUTH_GUARD_KEY_MISSING");
    return key.key;
  },
});
const native = (
  ctx: MutationCtx | QueryCtx,
  model: "user" | "account" | "session" | "verification",
  id: string,
) =>
  ctx.runQuery(components.betterAuth.adapter.findOne, {
    model,
    where: [{ field: "_id", value: id }],
  });
const root = (ctx: MutationCtx | QueryCtx, authId: string) =>
  ctx.db
    .query("authRoots")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
async function fenced(
  ctx: MutationCtx,
  kind: "authId" | "email" | "provider",
  value: string,
) {
  const hash = await guardedDigest(ctx, JSON.stringify([kind, value]));
  return !!(await ctx.db
    .query("authReplayFences")
    .withIndex("by_kind_and_digest", (q) =>
      q.eq("kind", kind).eq("digest", hash),
    )
    .unique());
}
export async function requireAdmittedIdentity(
  ctx: MutationCtx | QueryCtx,
  authId: string,
) {
  const journal = await root(ctx, authId);
  if (journal && journal.state !== "admitted")
    throw new ConvexError("AUTH_IDENTITY_INACTIVE");
}
async function eraseEmptyCandidate(ctx: MutationCtx, authId: string) {
  const journal = await root(ctx, authId);
  if (!journal?.neverAdmitted || journal.state === "admitted") return false;
  const app = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authId))
    .unique();
  if (app) return false;
  for (const model of ["account", "session"] as const) {
    if (
      await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model,
        where: [{ field: "userId", value: authId }],
      })
    )
      return false;
  }
  await ctx.db.patch(journal._id, { state: "revoked" });
  await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
    input: { model: "user", where: [{ field: "_id", value: authId }] },
  });
  return true;
}
export const expirePending = internalMutation({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    const journal = await root(ctx, args.authId);
    if (
      !journal ||
      journal.state !== "pending" ||
      journal.pendingUntil > Date.now()
    )
      return;
    await ctx.db.patch(journal._id, { state: "revoked" });
    await eraseEmptyCandidate(ctx, args.authId);
  },
});
async function consumePermit(
  ctx: MutationCtx,
  args: {
    model: string;
    operation: string;
    id: string;
    fields: string[];
    approvalNonce?: string;
  },
  row: Record<string, unknown>,
) {
  if (!args.approvalNonce) return null;
  const permit = await ctx.db
    .query("authWritePermits")
    .withIndex("by_nonce", (q) => q.eq("nonce", args.approvalNonce!))
    .unique();
  if (
    !permit ||
    permit.consumed ||
    permit.model !== args.model ||
    permit.operation !== args.operation ||
    (permit.targetId && permit.targetId !== args.id)
  )
    return null;
  const lease = await ctx.db.get(permit.leaseId);
  if (!lease || lease.state !== "active" || lease.expiresAt <= Date.now())
    return null;
  const input = Object.fromEntries(
    args.fields.map((field) => [field, row[field]]),
  );
  if (
    (await guardedDigest(
      ctx,
      canonicalWrite(args.model, args.operation, input),
    )) !== permit.operationDigest
  )
    return null;
  await ctx.db.patch(permit._id, { consumed: true });
  return { permit, lease };
}
async function latestFence(
  ctx: MutationCtx,
  kind: "authId" | "email" | "provider",
  value: string,
) {
  const hash = await guardedDigest(ctx, JSON.stringify([kind, value]));
  const fence = await ctx.db
    .query("authReplayFences")
    .withIndex("by_kind_and_digest", (q) =>
      q.eq("kind", kind).eq("digest", hash),
    )
    .unique();
  if (!fence) return null;
  const job = await ctx.db.get(fence.jobId);
  return job?.retentionUntil ?? Infinity;
}
async function verification(
  ctx: MutationCtx,
  id: string,
  consumed: boolean,
  proof: Awaited<ReturnType<typeof consumePermit>>,
) {
  const row = await native(ctx, "verification", id);
  if (!row) return;
  const old = await ctx.db
    .query("authVerificationJournal")
    .withIndex("by_nativeId", (q) => q.eq("nativeId", id))
    .unique();
  if (old) {
    if (consumed) await ctx.db.patch(old._id, { consumed: true });
    return;
  }
  let family = "unsupported";
  let ownerAuthId: string | undefined;
  let sessionDigest: string | undefined;
  let generation = proof?.lease.generation;
  if (
    row.identifier.startsWith("reset-password:") ||
    row.identifier.startsWith("delete-account-")
  ) {
    family = row.identifier.startsWith("reset-password:")
      ? "reset"
      : "delete-user";
    const owner = await native(ctx, "user", row.value);
    if (owner) ownerAuthId = owner._id;
  } else if (row.identifier.startsWith("one-time-token:")) {
    family = "ott";
    const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "token", value: row.value }],
    });
    if (session) {
      ownerAuthId = session.userId;
      sessionDigest = await guardedDigest(ctx, row.value);
    }
  } else {
    try {
      const value = JSON.parse(row.value);
      if (
        value.oauthState === row.identifier &&
        typeof value.codeVerifier === "string" &&
        typeof value.expiresAt === "number"
      )
        family = "state";
      if (
        family === "state" &&
        typeof value.link?.userId === "string" &&
        (await native(ctx, "user", value.link.userId))
      )
        ownerAuthId = value.link.userId;
      else if (
        typeof value.clientId === "string" &&
        typeof value.redirectURI === "string" &&
        typeof value.requireConsent === "boolean" &&
        typeof value.userId === "string" &&
        (await native(ctx, "user", value.userId))
      ) {
        family = "oidc";
        ownerAuthId = value.userId;
      }
    } catch {
      /* Native unknown verification values remain unowned. */
    }
  }
  const owner = ownerAuthId ? await root(ctx, ownerAuthId) : null;
  if (owner) generation = owner.generation;
  const current =
    !!proof?.lease.proven &&
    family !== "unsupported" &&
    (!ownerAuthId || owner?.state === "admitted");
  await ctx.db.insert("authVerificationJournal", {
    nativeId: id,
    identifierDigest: await guardedDigest(ctx, row.identifier),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    producer: current ? "current" : "unproven",
    consumed,
    family,
    ownerAuthId,
    sessionDigest,
    generation: current ? generation : undefined,
    producerLeaseId: current ? proof!.lease._id : undefined,
    originalStartedAt: current ? proof!.lease.originalStartedAt : undefined,
  });
}
async function guard(
  ctx: MutationCtx,
  args: {
    model: string;
    operation: string;
    id: string;
    fields: string[];
    previousOwner?: string;
    approvalNonce?: string;
  },
) {
  if (args.model === "verification") {
    const row = await native(ctx, "verification", args.id);
    const proof =
      row && args.fields.length ? await consumePermit(ctx, args, row) : null;
    await verification(
      ctx,
      args.id,
      args.operation === "verificationDelete",
      proof,
    );
    return true;
  }
  if (!["user", "account", "session"].includes(args.model)) return true;
  const model = args.model as "user" | "account" | "session";
  const row = await native(ctx, model, args.id);
  if (!row) return false;
  if (
    model !== "user" &&
    args.previousOwner !== undefined &&
    row.userId !== args.previousOwner
  )
    return false;
  const proof = await consumePermit(ctx, args, row);
  const invalidApproval = !!args.approvalNonce && !proof;
  if (model === "user" && args.operation === "create") {
    const emailFence = await latestFence(
      ctx,
      "email",
      row.email.trim().toLowerCase(),
    );
    const allowed =
      !invalidApproval &&
      (!emailFence ||
        (!!proof?.lease.proven && proof.lease.originalStartedAt >= emailFence));
    const bornAt = row._creationTime;
    await ctx.db.insert("authRoots", {
      authId: row._id,
      bornAt,
      pendingUntil: bornAt + pendingLifetime,
      state: "pending",
      neverAdmitted: true,
      generation: proof?.lease.generation ?? "legacy:" + row._id,
      requiresProof: emailFence !== null,
      proofAfter: emailFence ?? 0,
      birthLeaseId: proof?.lease._id,
    });
    await ctx.scheduler.runAfter(
      pendingLifetime,
      internal.operations.authAdmission.expirePending,
      { authId: row._id },
    );
    if (!allowed) {
      await eraseEmptyCandidate(ctx, row._id);
      return false;
    }
    return true;
  }
  if (invalidApproval) return false;
  const authId = model === "user" ? row._id : row.userId;
  const owner = model === "user" ? row : await native(ctx, "user", authId);
  if (!owner || (proof?.permit.authId && proof.permit.authId !== authId))
    return false;
  let journal = await root(ctx, authId);
  if (!journal) {
    const id = await ctx.db.insert("authRoots", {
      authId,
      bornAt: owner._creationTime,
      pendingUntil: owner._creationTime,
      state: "admitted",
      neverAdmitted: false,
      generation: "baseline:" + authId,
      requiresProof: false,
      proofAfter: 0,
    });
    journal = await ctx.db.get(id);
  }
  const emailFence = await latestFence(
    ctx,
    "email",
    owner.email.trim().toLowerCase(),
  );
  const providerFence =
    model === "account"
      ? await latestFence(
          ctx,
          "provider",
          JSON.stringify([row.providerId, row.accountId]),
        )
      : null;
  const fenceTime = Math.max(
    emailFence ?? 0,
    providerFence ?? 0,
    journal!.proofAfter,
  );
  const needsProof =
    journal!.requiresProof || emailFence !== null || providerFence !== null;
  const exactCurrent =
    !!proof?.lease.proven &&
    (!proof.lease.authId ||
      (proof.lease.authId === authId &&
        proof.lease.generation === journal!.generation));
  const newlyAdmitted = journal!.state === "pending";
  const allowed =
    journal!.state !== "revoked" &&
    (!newlyAdmitted || journal!.pendingUntil > Date.now()) &&
    !(await fenced(ctx, "authId", authId)) &&
    (!needsProof ||
      (exactCurrent &&
        (proof!.lease.source === "jwt" ||
          proof!.lease.originalStartedAt >= fenceTime) &&
        (!newlyAdmitted || proof!.lease.generation === journal!.generation)));
  if (!allowed) {
    if (
      model === "account" &&
      args.operation === "create" &&
      journal?.neverAdmitted
    ) {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: { model, where: [{ field: "_id", value: args.id }] },
      });
      await eraseEmptyCandidate(ctx, authId);
    }
    return false;
  }
  if (model === "session") {
    if (journal!.state !== "admitted") return false;
    if (proof && args.operation === "create")
      await ctx.db.insert("authLeaseSessions", {
        leaseId: proof.lease._id,
        authId,
        sessionId: row._id,
        generation: journal!.generation,
      });
    return true;
  }
  if (model === "account" && newlyAdmitted) {
    const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "userId", value: authId }],
    });
    if (session) return false;
    await ctx.db.patch(journal!._id, {
      state: "admitted",
      neverAdmitted: false,
      requiresProof: needsProof,
      proofAfter: fenceTime,
    });
  }
  return true;
}
export const onCreate = internalMutation({
  args: guardArgs,
  returns: v.boolean(),
  handler: guard,
});
export const onUpdate = internalMutation({
  args: guardArgs,
  returns: v.boolean(),
  handler: guard,
});
export const onVerificationDelete = internalMutation({
  args: guardArgs,
  returns: v.boolean(),
  handler: guard,
});
export const initialize = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (!(await ctx.db.query("authGuardKey").unique()))
      await ctx.db.insert("authGuardKey", {
        key: crypto.randomUUID() + crypto.randomUUID(),
      });
    await ctx.runMutation(components.betterAuth.guard.configure, {
      create: await createFunctionHandle(
        internal.operations.authAdmission.onCreate,
      ),
      update: await createFunctionHandle(
        internal.operations.authAdmission.onUpdate,
      ),
      verificationDelete: await createFunctionHandle(
        internal.operations.authAdmission.onVerificationDelete,
      ),
    });
  },
});
export const eligibility = internalQuery({
  args: {},
  handler: async (ctx) => {
    const health = await ctx.runQuery(components.betterAuth.guard.health, {});
    const key = await ctx.db.query("authGuardKey").unique();
    const eligible = health.configured && health.revision === revision && !!key;
    return {
      ...health,
      eligible,
      reason: eligible ? "READY" : "FIXED_GUARD_REQUIRED",
      retainedReplayFences: true,
      provisionalSignupTimeoutMs: pendingLifetime,
    };
  },
});
export const fencePreparedAccount = internalMutation({
  args: { jobId: v.id("deletionJobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.scope !== "account" || job.phase !== "fence" || !job.userId)
      throw new ConvexError("AUTH_FENCE_JOB_INVALID");
    const app = await ctx.db.get(job.userId);
    if (
      !app ||
      app.authId !== job.authId ||
      app.lifecycle !== "deleting" ||
      job.actorId !== app._id
    )
      throw new ConvexError("AUTH_FENCE_JOB_INVALID");
    const owner = await native(ctx, "user", job.authId);
    const identities: ["authId" | "email" | "provider", string][] = [
      ["authId", job.authId],
    ];
    if (owner) identities.push(["email", owner.email.trim().toLowerCase()]);
    const accounts = await ctx.runQuery(
      components.betterAuth.adapter.findMany,
      {
        model: "account",
        where: [{ field: "userId", value: job.authId }],
        paginationOpts: { numItems: 25, cursor: null },
      },
    );
    if (!accounts.isDone) throw new ConvexError("AUTH_FENCE_PAGE_REQUIRED");
    for (const account of accounts.page)
      identities.push([
        "provider",
        JSON.stringify([account.providerId, account.accountId]),
      ]);
    for (const [kind, value] of identities) {
      const hash = await guardedDigest(ctx, JSON.stringify([kind, value]));
      const old = await ctx.db
        .query("authReplayFences")
        .withIndex("by_kind_and_digest", (q) =>
          q.eq("kind", kind).eq("digest", hash),
        )
        .unique();
      if (!old)
        await ctx.db.insert("authReplayFences", {
          kind,
          digest: hash,
          jobId: job._id,
          createdAt: Date.now(),
        });
      else if (old.jobId !== job._id) {
        const previousJob = await ctx.db.get(old.jobId);
        // Keep the strongest proven barrier. Retrying a job never moves its
        // fixed deadline, and earlier jobs retain their audit retention.
        if (previousJob && job.retentionUntil > previousJob.retentionUntil)
          await ctx.db.patch(old._id, { jobId: job._id });
      }
    }
    const journal = await root(ctx, job.authId);
    if (journal) await ctx.db.patch(journal._id, { state: "revoked" });
    else if (owner)
      await ctx.db.insert("authRoots", {
        authId: job.authId,
        bornAt: owner._creationTime,
        pendingUntil: owner._creationTime,
        state: "revoked",
        neverAdmitted: false,
        generation: "baseline:" + job.authId,
        requiresProof: true,
        proofAfter: job.retentionUntil,
      });
  },
});

export const beginLease = internalMutation({
  args: {
    path: v.string(),
    source: v.string(),
    sourceDigest: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let originalStartedAt = now;
    let expiresAt = now + pendingLifetime;
    let generation: string = crypto.randomUUID();
    let authId: string | undefined;
    let proven = true;
    if (["jwt", "state", "reset", "ott"].includes(args.source)) {
      proven = false;
      if (args.source === "jwt" && args.sourceDigest) {
        const proof = await ctx.db
          .query("authEmailIssuance")
          .withIndex("by_tokenDigest", (q) =>
            q.eq("tokenDigest", args.sourceDigest!),
          )
          .unique();
        if (proof) {
          const producer = await ctx.db.get(proof.leaseId);
          proven = !!producer && producer.state !== "revoked";
          originalStartedAt = proof.issuedAt;
          expiresAt = Math.min(expiresAt, proof.expiresAt);
          generation = proof.generation;
          authId = proof.authId;
        }
      } else if (args.sourceDigest) {
        const proofs = await ctx.db
          .query("authVerificationJournal")
          .withIndex("by_identifierDigest", (q) =>
            q.eq("identifierDigest", args.sourceDigest!),
          )
          .take(2);
        const proof = proofs.length === 1 ? proofs[0] : null;
        if (
          proof?.producer === "current" &&
          proof.producerLeaseId &&
          proof.generation &&
          proof.originalStartedAt !== undefined
        ) {
          const producer = await ctx.db.get(proof.producerLeaseId);
          proven = !!producer && producer.state !== "revoked";
          originalStartedAt = proof.originalStartedAt;
          expiresAt = Math.min(expiresAt, proof.expiresAt);
          generation = proof.generation;
          authId = proof.ownerAuthId;
        }
      }
    }
    if (expiresAt <= now) proven = false;
    const id = await ctx.db.insert("authLeases", {
      startedAt: now,
      originalStartedAt,
      expiresAt,
      path: args.path,
      source: args.source,
      proven,
      generation,
      authId,
      state: "active",
    });
    await ctx.scheduler.runAfter(
      Math.max(0, expiresAt - now),
      internal.operations.authAdmission.recoverLease,
      { leaseId: id },
    );
    return { id, generation, authId, proven, expiresAt };
  },
});
export const issuePermit = internalMutation({
  args: {
    leaseId: v.id("authLeases"),
    nonce: v.string(),
    model: v.string(),
    operation: v.string(),
    operationDigest: v.string(),
    targetId: v.optional(v.string()),
    authId: v.optional(v.string()),
    verificationFamily: v.optional(v.string()),
    verificationOwner: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lease = await ctx.db.get(args.leaseId);
    if (!lease || lease.state !== "active" || lease.expiresAt <= Date.now())
      throw new ConvexError("AUTH_REQUEST_EXPIRED");
    if (lease.authId && args.authId && lease.authId !== args.authId)
      throw new ConvexError("AUTH_ARTIFACT_OWNER_MISMATCH");
    const issued = await ctx.db
      .query("authWritePermits")
      .withIndex("by_leaseId", (q) => q.eq("leaseId", args.leaseId))
      .take(25);
    if (issued.length >= 25) throw new ConvexError("AUTH_REQUEST_WRITE_BUDGET");
    const old = await ctx.db
      .query("authWritePermits")
      .withIndex("by_nonce", (q) => q.eq("nonce", args.nonce))
      .unique();
    if (old) throw new ConvexError("AUTH_APPROVAL_NONCE_REUSED");
    await ctx.db.insert("authWritePermits", { ...args, consumed: false });
  },
});
async function adoptExistingRoot(ctx: MutationCtx, authId: string) {
  let journal = await root(ctx, authId);
  if (!journal) {
    const owner = await native(ctx, "user", authId);
    if (!owner) return null;
    const id = await ctx.db.insert("authRoots", {
      authId,
      bornAt: owner._creationTime,
      pendingUntil: owner._creationTime,
      state: "admitted",
      neverAdmitted: false,
      generation: "baseline:" + authId,
      requiresProof: false,
      proofAfter: 0,
    });
    journal = await ctx.db.get(id);
  }
  return journal;
}
export const recordEmailIssuance = internalMutation({
  args: {
    leaseId: v.id("authLeases"),
    authId: v.string(),
    tokenDigest: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const lease = await ctx.db.get(args.leaseId);
    const journal = await adoptExistingRoot(ctx, args.authId);
    if (
      !lease ||
      lease.state !== "active" ||
      lease.expiresAt <= Date.now() ||
      !journal ||
      journal.state !== "admitted" ||
      (journal.requiresProof && !lease.proven)
    )
      throw new ConvexError("AUTH_EMAIL_ISSUANCE_DENIED");
    const old = await ctx.db
      .query("authEmailIssuance")
      .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", args.tokenDigest))
      .unique();
    if (old) {
      if (old.authId !== args.authId || old.generation !== journal.generation)
        throw new ConvexError("AUTH_EMAIL_ISSUANCE_CONFLICT");
      return;
    }
    await ctx.db.insert("authEmailIssuance", {
      ...args,
      generation: journal.generation,
    });
  },
});
export const recoverLease = internalMutation({
  args: { leaseId: v.id("authLeases") },
  handler: async (ctx, args) => {
    const lease = await ctx.db.get(args.leaseId);
    if (!lease || lease.state !== "active" || lease.expiresAt > Date.now())
      return;
    await ctx.db.patch(lease._id, { state: "revoked" });
    const permits = await ctx.db
      .query("authWritePermits")
      .withIndex("by_leaseId", (q) => q.eq("leaseId", lease._id))
      .take(25);
    for (const permit of permits)
      if (!permit.consumed) await ctx.db.patch(permit._id, { consumed: true });
    const sessions = await ctx.db
      .query("authLeaseSessions")
      .withIndex("by_leaseId", (q) => q.eq("leaseId", lease._id))
      .take(25);
    for (const session of sessions)
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "session",
          where: [{ field: "_id", value: session.sessionId }],
        },
      });
    const born = await ctx.db
      .query("authRoots")
      .withIndex("by_birthLeaseId", (q) => q.eq("birthLeaseId", lease._id))
      .take(25);
    for (const journal of born)
      if (journal.generation === lease.generation)
        await ctx.db.patch(journal._id, { state: "revoked" });
  },
});
export const finishLease = internalMutation({
  args: {
    leaseId: v.id("authLeases"),
    responseAuthId: v.optional(v.string()),
    responseSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const lease = await ctx.db.get(args.leaseId);
    if (!lease || lease.state !== "active" || lease.expiresAt <= Date.now())
      return false;
    if (args.responseAuthId) {
      const journal = await adoptExistingRoot(ctx, args.responseAuthId);
      if (
        !journal ||
        journal.state !== "admitted" ||
        (journal.requiresProof && !lease.proven) ||
        (lease.authId && lease.authId !== journal.authId)
      )
        return false;
    }
    if (args.responseSessionId) {
      const session = await native(ctx, "session", args.responseSessionId);
      if (
        !session ||
        session.expiresAt <= Date.now() ||
        (args.responseAuthId && session.userId !== args.responseAuthId)
      )
        return false;
      const journal = await adoptExistingRoot(ctx, session.userId);
      if (
        !journal ||
        journal.state !== "admitted" ||
        (journal.requiresProof && !lease.proven)
      )
        return false;
    }
    const sessions = await ctx.db
      .query("authLeaseSessions")
      .withIndex("by_leaseId", (q) => q.eq("leaseId", lease._id))
      .take(25);
    for (const proof of sessions) {
      const session = await native(ctx, "session", proof.sessionId);
      const journal = await root(ctx, proof.authId);
      if (
        !session ||
        !journal ||
        journal.state !== "admitted" ||
        journal.generation !== proof.generation ||
        session.userId !== proof.authId
      )
        return false;
    }
    await ctx.db.patch(lease._id, { state: "complete" });
    return true;
  },
});
const linkedModels = [
  "account",
  "session",
  "twoFactor",
  "oauthApplication",
  "oauthAccessToken",
  "oauthConsent",
] as const;
async function sealedTarget(
  ctx: MutationCtx | QueryCtx,
  jobId: import("../_generated/dataModel").Id<"deletionJobs">,
) {
  const job = await ctx.db.get(jobId);
  const journal = job ? await root(ctx, job.authId) : null;
  if (
    !job ||
    job.scope !== "account" ||
    !job.userId ||
    job.actorId !== job.userId ||
    !journal ||
    journal.state !== "revoked"
  )
    throw new ConvexError("AUTH_ERASURE_AUTHORITY_INVALID");
  const hash = await guardedDigest(ctx, JSON.stringify(["authId", job.authId]));
  const fence = await ctx.db
    .query("authReplayFences")
    .withIndex("by_kind_and_digest", (q) =>
      q.eq("kind", "authId").eq("digest", hash),
    )
    .unique();
  if (!fence || fence.jobId !== job._id)
    throw new ConvexError("AUTH_ERASURE_AUTHORITY_INVALID");
  return job;
}
export const captureVerificationPage = internalMutation({
  args: { jobId: v.id("deletionJobs"), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const job = await sealedTarget(ctx, args.jobId);
    const page = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "verification",
      paginationOpts: { numItems: 25, cursor: args.cursor },
    });
    let targetOwned = 0;
    let unsupported = 0;
    for (const row of page.page) {
      await verification(ctx, row._id, false, null);
      const proof = await ctx.db
        .query("authVerificationJournal")
        .withIndex("by_nativeId", (q) => q.eq("nativeId", row._id))
        .unique();
      if (proof?.ownerAuthId === job.authId) targetOwned++;
      if (proof?.family === "unsupported") unsupported++;
    }
    return {
      processed: page.page.length,
      targetOwned,
      unsupported,
      isDone: page.isDone,
      cursor: page.continueCursor,
    };
  },
});
export const nativeErasureProof = internalQuery({
  args: { jobId: v.id("deletionJobs") },
  handler: async (ctx, args) => {
    const job = await sealedTarget(ctx, args.jobId);
    const health = await ctx.runQuery(components.betterAuth.guard.health, {});
    let ownedRows = 0;
    for (const model of linkedModels) {
      const page = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model,
        where: [{ field: "userId", value: job.authId }],
        paginationOpts: { numItems: 25, cursor: null },
      });
      ownedRows += page.page.length;
    }
    const proofs = await ctx.db
      .query("authVerificationJournal")
      .withIndex("by_ownerAuthId_and_consumed", (q) =>
        q.eq("ownerAuthId", job.authId).eq("consumed", false),
      )
      .take(25);
    ownedRows += proofs.length;
    return {
      guardConfigured: health.configured && health.revision === revision,
      ownedRows,
      ownedAbsent: ownedRows === 0,
      rootPresent: !!(await native(ctx, "user", job.authId)),
      retainedReplayFences: true,
      unownedVerification: "preserved-not-certified" as const,
    };
  },
});
export const purgeNativePage = internalMutation({
  args: {
    jobId: v.id("deletionJobs"),
    model: v.union(
      v.literal("account"),
      v.literal("session"),
      v.literal("twoFactor"),
      v.literal("oauthApplication"),
      v.literal("oauthAccessToken"),
      v.literal("oauthConsent"),
      v.literal("verification"),
      v.literal("user"),
    ),
  },
  handler: async (ctx, args) => {
    const job = await sealedTarget(ctx, args.jobId);
    if (job.phase !== "auth")
      throw new ConvexError("AUTH_ERASURE_PHASE_REQUIRED");
    const health = await ctx.runQuery(components.betterAuth.guard.health, {});
    if (!health.configured || health.revision !== revision)
      throw new ConvexError("FIXED_GUARD_REQUIRED");
    if (args.model === "verification") {
      const proofs = await ctx.db
        .query("authVerificationJournal")
        .withIndex("by_ownerAuthId_and_consumed", (q) =>
          q.eq("ownerAuthId", job.authId).eq("consumed", false),
        )
        .take(25);
      let processed = 0;
      for (const proof of proofs) {
        if (await native(ctx, "verification", proof.nativeId)) {
          await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
            input: {
              model: "verification",
              where: [{ field: "_id", value: proof.nativeId }],
            },
          });
          processed++;
        } else await ctx.db.patch(proof._id, { consumed: true });
      }
      return { processed };
    }
    if (args.model === "user") {
      for (const model of linkedModels)
        if (
          await ctx.runQuery(components.betterAuth.adapter.findOne, {
            model,
            where: [{ field: "userId", value: job.authId }],
          })
        )
          throw new ConvexError("AUTH_ROOT_LAST_REQUIRED");
      const proofs = await ctx.db
        .query("authVerificationJournal")
        .withIndex("by_ownerAuthId_and_consumed", (q) =>
          q.eq("ownerAuthId", job.authId).eq("consumed", false),
        )
        .take(25);
      if (proofs.length) throw new ConvexError("AUTH_ROOT_LAST_REQUIRED");
      const owner = await native(ctx, "user", job.authId);
      if (owner)
        await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
          input: {
            model: "user",
            where: [{ field: "_id", value: job.authId }],
          },
        });
      return { processed: owner ? 1 : 0 };
    }
    const page = await ctx.runMutation(
      components.betterAuth.adapter.deleteMany,
      {
        input: {
          model: args.model,
          where: [{ field: "userId", value: job.authId }],
        },
        paginationOpts: { numItems: 25, cursor: null },
      },
    );
    return { processed: page.count };
  },
});

// Expired admission rows are never read as authority: every reader treats a
// missing lease/proof as unproven or denied (see consumePermit, issuePermit,
// recordEmailIssuance, finishLease, beginLease, recoverLease), so the sweep
// below only deletes rows 30 days past expiry. Native session rows are never
// touched here; recoverLease already reaps them at lease expiry.
const admissionRetention = 30 * 86400000;
export const sweep = internalMutation({
  args: {
    cursor: v.union(v.string(), v.null()),
    phase: v.union(
      v.literal("leases"),
      v.literal("issuance"),
      v.literal("journal"),
    ),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const cutoff = Date.now() - admissionRetention;
    if (a.phase === "leases") {
      const page = await ctx.db
        .query("authLeases")
        .paginate({ cursor: a.cursor, numItems: 50 });
      for (const lease of page.page) {
        if (lease.state === "active" || lease.expiresAt >= cutoff) continue;
        for (const permit of await ctx.db
          .query("authWritePermits")
          .withIndex("by_leaseId", (q) => q.eq("leaseId", lease._id))
          .collect())
          await ctx.db.delete(permit._id);
        for (const session of await ctx.db
          .query("authLeaseSessions")
          .withIndex("by_leaseId", (q) => q.eq("leaseId", lease._id))
          .collect())
          await ctx.db.delete(session._id);
        await ctx.db.delete(lease._id);
      }
      await ctx.scheduler.runAfter(
        0,
        internal.operations.authAdmission.sweep,
        page.isDone
          ? { cursor: null, phase: "issuance" }
          : { cursor: page.continueCursor, phase: "leases" },
      );
    } else if (a.phase === "issuance") {
      const page = await ctx.db
        .query("authEmailIssuance")
        .paginate({ cursor: a.cursor, numItems: 50 });
      for (const row of page.page)
        if (row.expiresAt < cutoff) await ctx.db.delete(row._id);
      await ctx.scheduler.runAfter(
        0,
        internal.operations.authAdmission.sweep,
        page.isDone
          ? { cursor: null, phase: "journal" }
          : { cursor: page.continueCursor, phase: "issuance" },
      );
    } else {
      const page = await ctx.db
        .query("authVerificationJournal")
        .paginate({ cursor: a.cursor, numItems: 50 });
      for (const row of page.page)
        // Only consumed rows: purgeNativePage marks a proof consumed exactly
        // when its native row is gone, so unconsumed rows still back live
        // erasure evidence and must survive.
        if (row.consumed && row.expiresAt < cutoff)
          await ctx.db.delete(row._id);
      if (!page.isDone)
        await ctx.scheduler.runAfter(
          0,
          internal.operations.authAdmission.sweep,
          { cursor: page.continueCursor, phase: "journal" },
        );
    }
    return null;
  },
});
