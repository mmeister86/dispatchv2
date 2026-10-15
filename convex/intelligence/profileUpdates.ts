import { ConvexError, v, type Infer } from "convex/values";
import { action, internalMutation, type QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  workspaceInternalMutation,
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireWorkspace,
  requireUser,
} from "../lib/authorization";
import { sha256 } from "../lib/crypto";
import { account, text, sourceReferenceContract } from "./profiles";
import { manifest } from "./algorithmProfiles";
import {
  sourceCheckDoc,
  sourceObservation,
  sourceState,
  sourceUpdateDoc,
  sourceVariant,
} from "./sharedFields";
import { resolveQuestions } from "../ai/jev/questions";
import { normalize } from "../ai/jev/normalize";
import { describeThread, dispatchScore } from "../ai/scoring/dispatchScore";
const WEEK = 7 * 86400000;
const SHA = /^[a-f0-9]{40}$/;
const args = {
  workspaceId: v.id("workspaces"),
  accountId: v.id("socialAccounts"),
  baseProfileId: v.id("algorithmProfiles"),
  commandKey: v.string(),
  full: v.boolean(),
};
type Observation = Infer<typeof sourceObservation>;
type Check = Extract<Doc<"intelligenceSourceUpdates">, { kind: "check" }>;
function fail(s: string): never {
  throw new ConvexError(s);
}
function key(s: string) {
  if (s.startsWith("proposal-") || !/^[A-Za-z0-9_-]{8,100}$/.test(s))
    fail("INTELLIGENCE_COMMAND_INVALID");
}
async function base(
  ctx: QueryCtx,
  ws: Id<"workspaces">,
  acc: Id<"socialAccounts">,
  id: Id<"algorithmProfiles">,
) {
  await account(ctx, ws, acc);
  const p = await ctx.db.get(id);
  if (
    !p ||
    p.workspaceId !== ws ||
    p.accountId !== acc ||
    p.network !== "x" ||
    p.surface !== "for_you" ||
    !SHA.test(p.payload.commit)
  )
    fail("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
  return p;
}
function visible(c: Check): Check {
  return c.state === "pending" && c.deadline <= Date.now()
    ? {
        ...c,
        state: "unknown",
        error: "deadline_elapsed",
        finishedAt: c.deadline,
      }
    : c;
}
export const reserve = workspaceInternalMutation({
  args: {
    accountId: args.accountId,
    baseProfileId: args.baseProfileId,
    commandKey: args.commandKey,
    full: args.full,
  },
  returns: v.object({ check: sourceCheckDoc, admitted: v.boolean() }),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    key(a.commandKey);
    const p = await base(ctx, ctx.workspace._id, a.accountId, a.baseProfileId);
    const fingerprint = await sha256(
      JSON.stringify({ baseProfileId: a.baseProfileId, full: a.full }),
    );
    const old = await ctx.db
      .query("intelligenceSourceUpdates")
      .withIndex("by_command", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (old) {
      if (old.kind !== "check" || old.fingerprint !== fingerprint)
        fail("INTELLIGENCE_OPERATION_CONFLICT");
      const check = visible(old);
      if (check.state !== old.state)
        await ctx.db.patch(old._id, {
          state: check.state,
          error: check.error,
          finishedAt: check.finishedAt,
        });
      return { check, admitted: false };
    }
    const latest = await ctx.db
      .query("intelligenceSourceUpdates")
      .withIndex("by_scope_kind", (q) =>
        q
          .eq("workspaceId", ctx.workspace._id)
          .eq("accountId", a.accountId)
          .eq("network", "x")
          .eq("surface", "for_you")
          .eq("kind", "check"),
      )
      .order("desc")
      .first();
    if (latest?.kind === "check") {
      const check = visible(latest);
      if (check.state !== latest.state)
        await ctx.db.patch(latest._id, {
          state: check.state,
          error: check.error,
          finishedAt: check.finishedAt,
        });
      if (latest.notBefore > Date.now()) fail("INTELLIGENCE_SOURCE_COOLDOWN");
    }
    const now = Date.now();
    const id = await ctx.db.insert("intelligenceSourceUpdates", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      network: "x",
      surface: "for_you",
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      baseProfileId: p._id,
      baseIdentity: await sha256(JSON.stringify(p.payload)),
      baseCommit: p.payload.commit,
      headCommit: null,
      createdAt: now,
      kind: "check",
      expectedPaths: manifest.map(([path]) => path),
      full: a.full,
      state: "pending",
      deadline: now + 45000,
      notBefore: now + 600000,
      finishedAt: null,
      requests: 0,
      bytes: 0,
      error: null,
      proposalId: null,
      observation: null,
    });
    return { check: (await ctx.db.get(id)) as Check, admitted: true };
  },
});
const observationUrl = (base: string, head: string) =>
  `https://github.com/xai-org/x-algorithm/compare/${base}...${head}`;
const fileUrl = (head: string, path: string) =>
  `https://github.com/xai-org/x-algorithm/blob/${head}/${path.split("/").map(encodeURIComponent).join("/")}`;
export const finishCheck = internalMutation({
  args: {
    checkId: v.id("intelligenceSourceUpdates"),
    state: sourceState,
    observation: v.union(sourceObservation, v.null()),
    error: v.union(v.string(), v.null()),
    requests: v.number(),
    bytes: v.number(),
    notBefore: v.number(),
  },
  returns: v.union(sourceCheckDoc, v.null()),
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.checkId);
    if (!c || c.kind !== "check") fail("INTELLIGENCE_SOURCE_RECEIPT_INVALID");
    if (
      !Number.isSafeInteger(a.requests) ||
      a.requests < 0 ||
      a.requests > 20 ||
      !Number.isSafeInteger(a.bytes) ||
      a.bytes < 0 ||
      a.bytes > Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(a.notBefore) ||
      a.notBefore < 0
    )
      fail("INTELLIGENCE_SOURCE_RECEIPT_INVALID");
    try {
      const currentUser = await requireUser(ctx);
      if (currentUser._id !== c.actorId)
        fail("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
      const user = await ctx.db.get(c.actorId);
      if (!user) fail("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
      requireRole(
        (await requireWorkspace(ctx, c.workspaceId, user)).membership,
        ["Owner", "Admin"],
      );
      const p = await base(ctx, c.workspaceId, c.accountId, c.baseProfileId);
      if ((await sha256(JSON.stringify(p.payload))) !== c.baseIdentity)
        fail("INTELLIGENCE_SOURCE_CHANGED");
    } catch {
      if (c.state === "pending")
        await ctx.db.patch(c._id, {
          state: "unknown",
          error: "authority_or_base_changed",
          requests: a.requests,
          bytes: a.bytes,
          notBefore: Math.max(
            c.notBefore,
            Math.min(a.notBefore, Date.now() + 86400000),
          ),
          finishedAt: Date.now(),
        });
      return null;
    }
    if (c.state !== "pending") return c;
    if (
      a.state === "pending" ||
      (a.state === "up_to_date" &&
        (a.observation?.commit !== c.baseCommit || c.full))
    )
      fail("INTELLIGENCE_SOURCE_RECEIPT_INVALID");
    let state = a.state,
      proposalId: Id<"intelligenceSourceUpdates"> | null = null;
    const observation = a.observation;
    if (Date.now() >= c.deadline) state = "unknown";
    if (
      observation &&
      (!SHA.test(observation.commit) ||
        !Number.isSafeInteger(observation.commitAt) ||
        observation.commitAt < 0 ||
        !Number.isSafeInteger(observation.observedAt) ||
        observation.observedAt < c.createdAt ||
        !Number.isSafeInteger(observation.reviewDueAt) ||
        observation.commitAt > observation.observedAt ||
        observation.observedAt > Date.now() ||
        observation.reviewDueAt !== observation.observedAt + WEEK ||
        observation.compareUrl !==
          observationUrl(c.baseCommit, observation.commit))
    )
      fail("INTELLIGENCE_SOURCE_RECEIPT_INVALID");
    if (state === "proposed") {
      if (
        !observation?.complete ||
        observation.issues.length ||
        observation.changes.length >= 300 ||
        observation.evidence.length !== manifest.length ||
        observation.evidence.some(
          (e, i) =>
            e.path !== manifest[i][0] ||
            !/^[a-f0-9]{64}$/.test(e.sha256) ||
            e.url !== fileUrl(observation.commit, e.path),
        )
      )
        fail("INTELLIGENCE_SOURCE_INCOMPLETE");
      const prior = await ctx.db
        .query("intelligenceSourceUpdates")
        .withIndex("by_base_head_kind", (q) =>
          q
            .eq("workspaceId", c.workspaceId)
            .eq("accountId", c.accountId)
            .eq("baseProfileId", c.baseProfileId)
            .eq("headCommit", observation.commit)
            .eq("kind", "proposal"),
        )
        .order("desc")
        .first();
      if (
        prior?.kind === "proposal" &&
        (!c.full || prior.observation.reviewDueAt > Date.now())
      )
        proposalId = prior._id;
      else {
        const {
          workspaceId,
          accountId,
          network,
          surface,
          actorId,
          commandKey,
          fingerprint,
          baseProfileId,
          baseIdentity,
          baseCommit,
        } = c;
        proposalId = await ctx.db.insert("intelligenceSourceUpdates", {
          workspaceId,
          accountId,
          network,
          surface,
          actorId,
          commandKey: `proposal-${c._id}`,
          fingerprint,
          baseProfileId,
          baseIdentity,
          baseCommit,
          headCommit: observation.commit,
          createdAt: Date.now(),
          kind: "proposal",
          checkId: c._id,
          observation,
        });
      }
    }
    await ctx.db.patch(c._id, {
      state,
      observation,
      headCommit: observation?.commit ?? null,
      proposalId,
      error: state === "unknown" ? "deadline_elapsed" : a.error,
      requests: a.requests,
      bytes: a.bytes,
      notBefore: Math.max(
        c.notBefore,
        Math.min(a.notBefore, Date.now() + 86400000),
      ),
      finishedAt: Date.now(),
    });
    return (await ctx.db.get(c._id)) as Check;
  },
});
export const check = action({
  args,
  returns: sourceCheckDoc,
  handler: async (ctx, a): Promise<Check> => {
    const admission = await ctx.runMutation(
      internal.intelligence.profileUpdates.reserve,
      a,
    );
    if (!admission.admitted) return admission.check;
    const c = admission.check;
    let requests = 0,
      bytes = 0,
      notBefore = 0,
      observation: Observation | null = null;
    let state: Check["state"] = "failed",
      error: string | null = null;
    async function read(
      url: string,
      raw = false,
    ): Promise<{ body: Uint8Array; response: Response }> {
      if (requests >= 20 || Date.now() >= c.deadline)
        throw new Error("deadline_or_request_limit");
      requests++;
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        Math.min(15000, c.deadline - Date.now()),
      );
      try {
        const response = await fetch(url, {
          redirect: "error",
          signal: controller.signal,
          headers: raw
            ? {}
            : {
                Accept: "application/vnd.github+json",
                "X-GitHub-Api-Version": "2026-03-10",
              },
        });
        const rateLimited =
          response.status === 429 ||
          (response.status === 403 &&
            (response.headers.get("x-ratelimit-remaining") === "0" ||
              response.headers.has("retry-after")));
        if (rateLimited) {
          const retry = response.headers.get("retry-after"),
            reset = Number(response.headers.get("x-ratelimit-reset"));
          const retryAt =
            retry === null
              ? 0
              : /^\d+$/.test(retry)
                ? Date.now() + Number(retry) * 1000
                : Date.parse(retry);
          notBefore = Math.max(
            Date.now() + 60000,
            Number.isFinite(retryAt)
              ? Math.min(retryAt, Date.now() + 86400000)
              : 0,
            Number.isFinite(reset)
              ? Math.min(reset * 1000, Date.now() + 86400000)
              : 0,
          );
        }
        const chunks: Uint8Array[] = [];
        let size = 0;
        const reader = response.body?.getReader();
        if (reader) {
          try {
            for (;;) {
              const next = await reader.read();
              if (next.done) break;
              size += next.value.byteLength;
              bytes += next.value.byteLength;
              if (
                size > (raw ? 1024 * 1024 : 2 * 1024 * 1024) ||
                bytes > 6 * 1024 * 1024 ||
                Date.now() >= c.deadline
              )
                throw new Error("response_byte_or_deadline_limit");
              chunks.push(next.value);
            }
          } finally {
            await reader.cancel();
          }
        }
        if (rateLimited) throw new Error("rate_limited");
        if (!response.ok) throw new Error(`http_${response.status}`);
        const body = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return { body, response };
      } finally {
        clearTimeout(timer);
      }
    }
    const parse = (b: Uint8Array): unknown =>
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b));
    try {
      const head = parse(
        (
          await read(
            "https://api.github.com/repos/xai-org/x-algorithm/commits/main",
          )
        ).body,
      ) as { sha?: unknown; commit?: { committer?: { date?: unknown } } };
      const commit = head.sha,
        date = head.commit?.committer?.date;
      if (
        typeof commit !== "string" ||
        !SHA.test(commit) ||
        typeof date !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(date) ||
        !Number.isSafeInteger(Date.parse(date)) ||
        new Date(Date.parse(date)).toISOString().replace(".000Z", "Z") !==
          date ||
        Date.parse(date) > Date.now()
      )
        throw new Error("invalid_head");
      const observedAt = Date.now();
      observation = {
        commit,
        commitAt: Date.parse(date),
        observedAt,
        reviewDueAt: observedAt + WEEK,
        compareUrl: observationUrl(c.baseCommit, commit),
        complete: false,
        issues: [],
        evidence: [],
        changes: [],
      };
      if (commit === c.baseCommit && !c.full) state = "up_to_date";
      else {
        if (commit !== c.baseCommit) {
          const compare = await read(
            `https://api.github.com/repos/xai-org/x-algorithm/compare/${c.baseCommit}...${commit}?per_page=100&page=1`,
          );
          const data = parse(compare.body) as {
            status?: unknown;
            total_commits?: unknown;
            ahead_by?: unknown;
            behind_by?: unknown;
            base_commit?: { sha?: unknown };
            merge_base_commit?: { sha?: unknown };
            commits?: { sha?: unknown }[];
            files?: {
              filename?: unknown;
              status?: unknown;
              patch?: unknown;
              previous_filename?: unknown;
            }[];
          };
          if (
            data.status !== "ahead" ||
            data.behind_by !== 0 ||
            data.base_commit?.sha !== c.baseCommit ||
            data.merge_base_commit?.sha !== c.baseCommit ||
            !Array.isArray(data.commits) ||
            data.total_commits !== data.commits.length ||
            data.ahead_by !== data.total_commits ||
            !data.commits.length ||
            data.commits.at(-1)?.sha !== commit ||
            data.commits.some(
              (x) => typeof x.sha !== "string" || !SHA.test(x.sha),
            ) ||
            /;\s*rel\s*=\s*(?:"[^"]*\bnext\b[^"]*"|next(?:[,;]|$))/i.test(
              compare.response.headers.get("link") ?? "",
            )
          )
            observation.issues.push("compare_incomplete_or_nonancestor");
          if (!Array.isArray(data.files) || data.files.length >= 300)
            observation.issues.push("changed_paths_incomplete");
          let patchBudget = 32768,
            pathBytes = 0;
          for (const f of Array.isArray(data.files)
            ? data.files.slice(0, 300)
            : []) {
            if (
              typeof f.filename !== "string" ||
              !f.filename ||
              f.filename.length > 1000 ||
              /[\u0000-\u001f]/.test(f.filename) ||
              typeof f.status !== "string" ||
              ![
                "added",
                "removed",
                "modified",
                "renamed",
                "copied",
                "changed",
                "unchanged",
              ].includes(f.status)
            ) {
              observation.issues.push("invalid_changed_path");
              continue;
            }
            pathBytes += new TextEncoder().encode(
              f.filename + fileUrl(commit, f.filename),
            ).length;
            if (pathBytes > 128 * 1024) {
              observation.issues.push("path_evidence_limit");
              break;
            }
            const fullPatch = typeof f.patch === "string" ? f.patch : "";
            let patch = fullPatch.slice(0, Math.min(2000, patchBudget));
            while (new TextEncoder().encode(patch).length > patchBudget)
              patch = patch.slice(0, -1);
            patchBudget -= new TextEncoder().encode(patch).length;
            observation.changes.push({
              path: f.filename,
              status: f.status,
              url: fileUrl(
                f.status === "removed" ? c.baseCommit : commit,
                f.filename,
              ),
              patch,
              patchState:
                typeof f.patch !== "string"
                  ? "missing"
                  : patch !== fullPatch
                    ? "clipped"
                    : "complete",
            });
          }
          if (
            new Set(observation.changes.map((x) => x.path)).size !==
            observation.changes.length
          )
            observation.issues.push("duplicate_changed_path");
        }
        for (const [path] of manifest) {
          const raw = await read(
            `https://raw.githubusercontent.com/xai-org/x-algorithm/${commit}/${path}`,
            true,
          );
          const digest = await crypto.subtle.digest(
            "SHA-256",
            raw.body as Uint8Array<ArrayBuffer>,
          );
          observation.evidence.push({
            path,
            url: fileUrl(commit, path),
            sha256: Array.from(new Uint8Array(digest), (n) =>
              n.toString(16).padStart(2, "0"),
            ).join(""),
          });
        }
        observation.complete = observation.issues.length === 0;
        state = observation.complete ? "proposed" : "incomplete";
      }
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "transport_failed";
      state =
        error === "rate_limited"
          ? "rate_limited"
          : /limit|deadline/.test(error) || observation !== null
            ? "incomplete"
            : "failed";
      if (observation) {
        observation.complete = false;
        observation.issues.push(error);
      }
    }
    const result: Check | null = await ctx.runMutation(
      internal.intelligence.profileUpdates.finishCheck,
      { checkId: c._id, state, observation, error, requests, bytes, notBefore },
    );
    if (!result) fail("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
    return result;
  },
});
export const inspect = workspaceMutation({
  args: {
    accountId: args.accountId,
    checkId: v.id("intelligenceSourceUpdates"),
  },
  returns: sourceCheckDoc,
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    await account(ctx, ctx.workspace._id, a.accountId);
    const c = await ctx.db.get(a.checkId);
    if (
      !c ||
      c.kind !== "check" ||
      c.workspaceId !== ctx.workspace._id ||
      c.accountId !== a.accountId
    )
      fail("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
    const result = visible(c);
    if (result.state !== c.state)
      await ctx.db.patch(c._id, {
        state: result.state,
        error: result.error,
        finishedAt: result.finishedAt,
      });
    return result;
  },
});
export const list = workspaceQuery({
  args: { accountId: args.accountId },
  returns: v.array(sourceUpdateDoc),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    await account(ctx, ctx.workspace._id, a.accountId);
    // ponytail: latest 15 of each kind; paginate when an account needs older source-review history.
    const rows = await Promise.all(
      (["check", "proposal", "evaluation"] as const).map((kind) =>
        ctx.db
          .query("intelligenceSourceUpdates")
          .withIndex("by_scope_kind", (q) =>
            q
              .eq("workspaceId", ctx.workspace._id)
              .eq("accountId", a.accountId)
              .eq("network", "x")
              .eq("surface", "for_you")
              .eq("kind", kind),
          )
          .order("desc")
          .take(15),
      ),
    );
    return rows.flat().map((c) => (c.kind === "check" ? visible(c) : c));
  },
});
export const evaluate = workspaceMutation({
  args: {
    accountId: args.accountId,
    proposalId: v.id("intelligenceSourceUpdates"),
    commandKey: args.commandKey,
    variant: sourceVariant,
    interpretation: v.string(),
    impact: v.string(),
    rationale: v.string(),
    fullSourceReview: v.boolean(),
  },
  returns: v.id("intelligenceSourceUpdates"),
  handler: async (ctx, a) => {
    requireRole(ctx.membership, ["Owner", "Admin"]);
    key(a.commandKey);
    text(a.interpretation, 4000);
    text(a.impact, 2000);
    text(a.rationale, 2000);
    const p = await ctx.db.get(a.proposalId);
    if (
      !p ||
      p.kind !== "proposal" ||
      p.workspaceId !== ctx.workspace._id ||
      p.accountId !== a.accountId
    )
      fail("INTELLIGENCE_REFERENCE_ACCESS_DENIED");
    const original = await base(
      ctx,
      p.workspaceId,
      p.accountId,
      p.baseProfileId,
    );
    const fingerprint = await sha256(JSON.stringify(a));
    const old = await ctx.db
      .query("intelligenceSourceUpdates")
      .withIndex("by_command", (q) =>
        q
          .eq("workspaceId", p.workspaceId)
          .eq("accountId", p.accountId)
          .eq("actorId", ctx.user._id)
          .eq("commandKey", a.commandKey),
      )
      .unique();
    if (old) {
      if (old.kind !== "evaluation" || old.fingerprint !== fingerprint)
        fail("INTELLIGENCE_OPERATION_CONFLICT");
      return old._id;
    }
    if (
      !a.fullSourceReview ||
      !p.observation.complete ||
      p.observation.issues.length ||
      p.observation.reviewDueAt <= Date.now() ||
      (await sha256(JSON.stringify(original.payload))) !== p.baseIdentity
    )
      fail("INTELLIGENCE_SOURCE_REVIEW_REQUIRED");
    const common = {
      formula: "dispatch-score-v1" as const,
      routing: "disabled-v1" as const,
      verification: "disabled-v1" as const,
    };
    const refs =
      a.variant === "post-analysis"
        ? {
            ...common,
            questionSet: "jev-post-analysis-v1" as const,
            normalization: "jev-normalization-v1" as const,
          }
        : {
            ...common,
            questionSet: "unavailable-until-task28" as const,
            normalization: "unavailable-until-task28" as const,
          };
    const reference = {
      version: "source-compatibility-v1" as const,
      contract: "",
      passed: true,
      outcomes: [] as {
        case: string;
        outcome: string;
        aggregate: number | null;
      }[],
    };
    const candidate = {
      ...original,
      payload: {
        ...original.payload,
        version:
          a.variant === "post-analysis"
            ? "x-post-analysis-v1"
            : "x-public-context-v1",
        refs,
      },
    } as Doc<"algorithmProfiles">;
    reference.contract = await sourceReferenceContract(candidate);
    if (a.variant === "public-context")
      reference.outcomes.push({
        case: "informational",
        outcome: "non_executable",
        aggregate: null,
      });
    else {
      const definition = resolveQuestions(candidate);
      for (const confidence of [1, 0] as const) {
        const answers = Object.fromEntries(
          Object.entries(definition.questions).map(([name, q]) => [
            name,
            q.type === "noul"
              ? { type: "noul", noul: 0.5 }
              : q.type === "choice"
                ? {
                    type: "choice",
                    choice: "educational",
                    confidence,
                    probabilities: Object.fromEntries(
                      Object.keys(q.criteria).map((k) => [
                        k,
                        k === "educational" ? 1 : 0,
                      ]),
                    ),
                  }
                : {
                    type: "score",
                    score: 2,
                    confidence,
                    probabilities: Object.fromEntries(
                      q.criteria.map((_, i) => [String(i), i === 2 ? 1 : 0]),
                    ),
                    legend: Object.fromEntries(
                      q.criteria.map((s, i) => [String(i), s]),
                    ),
                  },
          ]),
        );
        const normalized = normalize(
          {
            model: "jev-1.13.0",
            usage: { input_tokens: 0, output_tokens: 0 },
            answers,
          },
          definition.questions,
        );
        const descriptor = describeThread(
          [{ position: 0, text: "A fixed source maintenance reference." }],
          [],
          { maxText: 280 },
        );
        const score = dispatchScore(
          "answers" in normalized ? normalized.answers : null,
          descriptor.structure,
        );
        reference.outcomes.push({
          case: confidence ? "neutral-valid" : "low-confidence",
          outcome: normalized.outcome,
          aggregate: score.aggregate,
        });
        reference.passed &&= confidence
          ? normalized.outcome === "success" &&
            score.aggregate !== null &&
            Math.abs(score.aggregate - 55) < 1e-9
          : normalized.outcome === "low_confidence" && score.aggregate === null;
      }
      const invalid = normalize({}, definition.questions);
      reference.outcomes.push({
        case: "malformed",
        outcome: invalid.outcome,
        aggregate: null,
      });
      reference.passed &&= invalid.outcome === "invalid_response";
    }
    return ctx.db.insert("intelligenceSourceUpdates", {
      workspaceId: p.workspaceId,
      accountId: p.accountId,
      network: "x",
      surface: "for_you",
      actorId: ctx.user._id,
      commandKey: a.commandKey,
      fingerprint,
      baseProfileId: p.baseProfileId,
      baseIdentity: p.baseIdentity,
      baseCommit: p.baseCommit,
      headCommit: p.headCommit,
      createdAt: Date.now(),
      kind: "evaluation",
      proposalId: p._id,
      variant: a.variant,
      refs,
      interpretation: a.interpretation,
      impact: a.impact,
      rationale: a.rationale,
      fullSourceReview: true,
      reference,
    });
  },
});
