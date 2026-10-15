import { ConvexError, v, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { role } from "../schema";
import {
  signalFields,
  recoveryFields,
} from "../integrations/github/signalFields";
import { checkSource } from "../integrations/github/repositories";
import { EXPORT_PAGE_CANDIDATES, EXPORT_PAGE_MAX_BYTES } from "./exportShared";
import { checkRecoverySource } from "../integrations/github/recoveryState";
import {
  candidateProof,
  draftResearchProof,
  ideaProofUntil,
} from "../research/contentProof";
import { materialWalk } from "../research/pipelineAccess";
import { currentIdeaSource } from "../content/ideas";
import { currentEvidence } from "../research/evidence";
function pick<T, const K extends readonly (keyof T)[]>(
  r: T,
  keys: K,
): Pick<T, K[number]> {
  return Object.fromEntries(
    keys.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]),
  ) as Pick<T, K[number]>;
}
function check(x: unknown): asserts x {
  if (!x) throw new ConvexError("REFERENCE_ACCESS_DENIED");
}
const signalKeys = [
  "repositoryId",
  "generation",
  "kind",
  "fullName",
  "private",
  "ref",
  "before",
  "after",
  "commitCount",
  "created",
  "deleted",
  "forced",
  "releaseId",
  "tag",
  "prerelease",
  "url",
  "providerAt",
  "receivedAt",
  "processedAt",
  "explicitRecovery",
] as const;
const recoveryKeys = [
  "repositoryId",
  "generation",
  "providerId",
  "installationId",
  "event",
  "deliveredAt",
  "providerStatus",
  "state",
  "attempts",
  "notBefore",
  "updatedAt",
] as const;
const handoff = v.object({
  ideaVersionId: v.id("ideaVersions"),
  ideaRevision: v.number(),
  accountId: v.union(v.id("socialAccounts"), v.null()),
  draftId: v.id("drafts"),
  draftVersionId: v.id("draftVersions"),
  actorId: v.id("users"),
  intent: v.string(),
  clarificationConfirmed: v.boolean(),
  text: v.string(),
  at: v.number(),
});
const result = v.object({
  ideaId: v.id("ideas"),
  ideaVersionId: v.id("ideaVersions"),
  draftId: v.union(v.id("drafts"), v.null()),
  draftVersionId: v.union(v.id("draftVersions"), v.null()),
});
export const moreRow = v.union(
  v.object({
    id: v.id("githubSignals"),
    createdInDatabaseAt: v.number(),
    ...pick(signalFields, signalKeys),
  }),
  v.object({
    id: v.id("githubRecoveries"),
    createdInDatabaseAt: v.number(),
    ...pick(recoveryFields, recoveryKeys),
  }),
  v.object({
    id: v.id("teamInvitations"),
    createdInDatabaseAt: v.number(),
    email: v.optional(v.string()),
    role: v.optional(role),
    createdAt: v.number(),
    expiresAt: v.number(),
    status: v.union(
      ...(
        ["pending", "accepted", "revoked", "expired", "unavailable"] as const
      ).map(v.literal),
    ),
  }),
  v.object({ id: v.id("ideas"), createdInDatabaseAt: v.number(), handoff }),
  v.object({
    id: v.id("researchContentHandoffs"),
    createdInDatabaseAt: v.number(),
    accountId: v.id("socialAccounts"),
    actorId: v.id("users"),
    createdAt: v.number(),
    count: v.number(),
    target: v.union(v.literal("idea"), v.literal("draft")),
    selection: v.array(v.id("researchEvidence")),
    results: v.array(result),
  }),
  v.object({
    id: v.id("mediaVersionReferences"),
    createdInDatabaseAt: v.number(),
    assetId: v.id("mediaAssets"),
    versionId: v.union(v.id("draftVersions"), v.id("ideaVersions")),
    versionKind: v.union(v.literal("draft"), v.literal("idea")),
    positions: v.array(v.object({ position: v.number(), alt: v.string() })),
  }),
);
export const moreFamilies = [
  "publicGithubSignals",
  "publicGithubRecoveries",
  "ownCreatedInvitations",
  "ownReceivedInvitations",
  "ownIdeaHandoffs",
  "ownResearchHandoffs",
  "mediaVersionReferences",
] as const;
export type MoreFamily = (typeof moreFamilies)[number];
export async function morePage(
  ctx: QueryCtx,
  a: {
    family: MoreFamily;
    cursor: string | null;
    narrowPage?: boolean;
    version?:
      | { kind: "draft"; id: Id<"draftVersions"> }
      | { kind: "idea"; id: Id<"ideaVersions"> };
  },
  ws: Id<"workspaces">,
  actor: Id<"users">,
  bound: number,
  email: string | null,
  horizon: (n: number | null) => void,
) {
  const opts = {
      numItems: a.narrowPage === true ? 1 : EXPORT_PAGE_CANDIDATES,
      cursor: a.cursor,
      maximumBytesRead: EXPORT_PAGE_MAX_BYTES,
    },
    rows: Infer<typeof moreRow>[] = [];
  const walk = materialWalk();
  if (a.family === "mediaVersionReferences") {
    check(a.version);
    const version = await ctx.db.get(a.version.id);
    check(version);
    let media: { assetId: Id<"mediaAssets">; alt: string }[];
    if (a.version.kind === "draft") {
      const ver = await ctx.db.get(a.version.id);
      check(ver);
      check(await ctx.db.get(ver.draftId));
      horizon(await draftResearchProof(ctx, ver, walk));
      media = ver.content.media;
    } else {
      const ver = await ctx.db.get(a.version.id);
      check(ver);
      check(await ctx.db.get(ver.ideaId));
      await currentIdeaSource(ctx, ws, ver.source, walk);
      horizon(await ideaProofUntil(ctx, ver, walk));
      await candidateProof(ctx, ver, false, walk);
      check(ver.candidate);
      media = ver.candidate.content.media;
    }
    const p = await ctx.db
      .query("mediaVersionReferences")
      .withIndex("by_versionId", (q) =>
        q.eq("versionId", a.version!.id).lte("_creationTime", bound),
      )
      .order("asc")
      .paginate(opts);
    for (const r of p.page) {
      check(await ctx.db.get(r.assetId));
      const positions = media.flatMap((m, i) =>
        m.assetId === r.assetId ? [{ position: i, alt: m.alt }] : [],
      );
      check(positions.length);
      rows.push({
        id: r._id,
        createdInDatabaseAt: r._creationTime,
        assetId: r.assetId,
        versionId: r.versionId,
        versionKind: a.version.kind,
        positions,
      });
    }
    return { ...p, rows };
  }
  if (a.family === "publicGithubSignals") {
    const p = await ctx.db
      .query("githubSignals")
      .withIndex("by_public_workspace", (q) =>
        q
          .eq("workspaceId", ws)
          .eq("private", false)
          .lte("_creationTime", bound),
      )
      .order("asc")
      .paginate(opts);
    for (const r of p.page) {
      const repo = await checkSource(
        ctx,
        ws,
        r.repositoryId,
        r.generation,
        "monitoring",
      );
      check(!repo.private && repo.fullName === r.fullName);
      const receipt = await ctx.db.get(r.receiptId);
      check(
        receipt &&
          receipt.digest === r.digest &&
          receipt.facts.providerId === repo.providerId &&
          receipt.facts.installationId === repo.installationId,
      );
      for (const key of [
        "kind",
        "fullName",
        "private",
        "ref",
        "before",
        "after",
        "created",
        "deleted",
        "forced",
        "commitCount",
        "releaseId",
        "tag",
        "prerelease",
      ] as const)
        check(receipt.facts[key] === r[key]);
      if (r.explicitRecovery) {
        const recovery = await ctx.db.get(r.explicitRecovery.recoveryId);
        check(
          recovery &&
            recovery.repositoryId === r.repositoryId &&
            recovery.generation === r.generation,
        );
        check(await ctx.db.get(r.explicitRecovery.actorId));
      }
      horizon(repo.proofExpiresAt);
      rows.push({
        id: r._id,
        createdInDatabaseAt: r._creationTime,
        ...pick(r, signalKeys),
      });
    }
    return { ...p, rows };
  }
  if (a.family === "publicGithubRecoveries") {
    const p = await ctx.db
      .query("githubRecoveries")
      .withIndex("by_workspaceId", (q) =>
        q.eq("workspaceId", ws).lte("_creationTime", bound),
      )
      .order("asc")
      .paginate(opts);
    for (const r of p.page) {
      const stored = await ctx.db.get(r.repositoryId);
      check(stored);
      if (stored.private) continue;
      const repo = await checkRecoverySource(ctx, r, r.generation);
      check(!repo.private);
      horizon(repo.proofExpiresAt);
      rows.push({
        id: r._id,
        createdInDatabaseAt: r._creationTime,
        ...pick(r, recoveryKeys),
      });
    }
    return { ...p, rows };
  }
  if (
    a.family === "ownCreatedInvitations" ||
    a.family === "ownReceivedInvitations"
  ) {
    if (a.family === "ownReceivedInvitations") check(email);
    const q = ctx.db.query("teamInvitations");
    const p = await (
      a.family === "ownCreatedInvitations"
        ? q.withIndex("by_workspace_createdBy", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("createdBy", actor)
              .lte("_creationTime", bound),
          )
        : q.withIndex("by_workspace_email", (q) =>
            q
              .eq("workspaceId", ws)
              .eq("email", email!)
              .lte("_creationTime", bound),
          )
    )
      .order("asc")
      .paginate(opts);
    for (const r of p.page) {
      check(
        a.family === "ownCreatedInvitations"
          ? r.createdBy === actor
          : r.email === email,
      );
      rows.push({
        id: r._id,
        createdInDatabaseAt: r._creationTime,
        ...pick(r, ["email", "role", "status", "createdAt", "expiresAt"]),
      });
    }
    return { ...p, rows };
  }
  if (a.family === "ownIdeaHandoffs") {
    const p = await ctx.db
      .query("ideas")
      .withIndex("by_workspace_handoff_actor", (q) =>
        q
          .eq("workspaceId", ws)
          .eq("handoff.actorId", actor)
          .lte("_creationTime", bound),
      )
      .order("asc")
      .paginate(opts);
    for (const r of p.page) {
      const h = r.handoff;
      check(h && h.actorId === actor);
      const ver = await ctx.db.get(h.ideaVersionId),
        draft = await ctx.db.get(h.draftId),
        dv = await ctx.db.get(h.draftVersionId);
      check(
        ver &&
          ver.ideaId === r._id &&
          draft &&
          dv &&
          dv.ideaVersionId === ver._id &&
          dv.draftId === draft._id &&
          dv.content.accountId === h.accountId,
      );
      if (h.accountId) check(await ctx.db.get(h.accountId));
      await currentIdeaSource(ctx, ws, ver.source, walk);
      horizon(await ideaProofUntil(ctx, ver, walk, h.accountId ?? undefined));
      horizon(await draftResearchProof(ctx, dv, walk));
      rows.push({
        id: r._id,
        createdInDatabaseAt: r._creationTime,
        handoff: pick(h, [
          "ideaVersionId",
          "ideaRevision",
          "accountId",
          "draftId",
          "draftVersionId",
          "actorId",
          "intent",
          "clarificationConfirmed",
          "text",
          "at",
        ]),
      });
    }
    return { ...p, rows };
  }
  const p = await ctx.db
    .query("researchContentHandoffs")
    .withIndex("by_workspace_actor", (q) =>
      q.eq("workspaceId", ws).eq("actorId", actor).lte("_creationTime", bound),
    )
    .order("asc")
    .paginate(opts);
  for (const r of p.page) {
    check(
      r.actorId === actor &&
        Number.isSafeInteger(r.count) &&
        r.count >= 1 &&
        r.count <= 5 &&
        r.selection.length > 0 &&
        r.selection.length <= r.count &&
        new Set(r.selection).size === r.selection.length &&
        r.results.length === r.selection.length,
    );
    check(await ctx.db.get(r.accountId));
    for (const [i, eid] of r.selection.entries()) {
      const e = await ctx.db.get(eid);
      check(e);
      const order = await ctx.db.get(e.orderId);
      check(order);
      if (order.targetedChat) check(order.actorId === actor);
      const ep = await currentEvidence(ctx, ws, eid, r.accountId);
      horizon(ep.proofUntil);
      const result = r.results[i],
        idea = await ctx.db.get(result.ideaId),
        ver = await ctx.db.get(result.ideaVersionId);
      check(
        idea &&
          idea.actorId === actor &&
          ver &&
          ver.ideaId === idea._id &&
          ver.source.kind === "research" &&
          ver.source.evidenceId === eid &&
          ver.source.orderId === e.orderId,
      );
      horizon(await ideaProofUntil(ctx, ver, walk, r.accountId));
      if (r.target === "draft") {
        check(result.draftId && result.draftVersionId);
        const draft = await ctx.db.get(result.draftId),
          dv = await ctx.db.get(result.draftVersionId);
        check(
          draft &&
            dv &&
            dv.ideaVersionId === ver._id &&
            dv.draftId === draft._id &&
            dv.content.accountId === r.accountId,
        );
        horizon(await draftResearchProof(ctx, dv, walk));
      } else check(result.draftId === null && result.draftVersionId === null);
    }
    rows.push({
      id: r._id,
      createdInDatabaseAt: r._creationTime,
      ...pick(r, [
        "accountId",
        "actorId",
        "createdAt",
        "count",
        "target",
        "selection",
        "results",
      ]),
    });
  }
  return { ...p, rows };
}
