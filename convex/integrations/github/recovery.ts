"use node";
import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { appJwt } from "./app";
import { workspaceArgs } from "./fields";
import { observedDelivery } from "./signalFields";
import type { Infer } from "convex/values";
class RecoveryError extends Error {
  constructor(
    public code: string,
    public notBefore = 0,
  ) {
    super(code);
  }
}
function token() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  if (
    !clientId ||
    !process.env.GITHUB_APP_ID ||
    !process.env.GITHUB_WEBHOOK_SECRET ||
    process.env.GITHUB_WEBHOOK_SECRET.length < 16
  )
    throw new RecoveryError("GITHUB_WEBHOOK_CONFIGURATION_REQUIRED");
  return appJwt({ clientId });
}
export async function deliveryRequest(
  path: string,
  jwt: string,
  cursor: string | null = null,
): Promise<{ data: unknown; next: string | null }> {
  if (!/^\/app\/hook\/deliveries(?:\/\d{1,19}\/attempts)?$/.test(path))
    throw new RecoveryError("GITHUB_PROVIDER_ENDPOINT_INVALID");
  const post = path.endsWith("/attempts"),
    controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const url = new URL(`https://api.github.com${path}`);
    if (!post) {
      url.searchParams.set("per_page", "100");
      if (cursor) {
        if (cursor.length > 1024 || /[\u0000-\u001f]/.test(cursor))
          throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
        url.searchParams.set("cursor", cursor);
      }
    }
    const response = await fetch(url, {
      method: post ? "POST" : "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "X-GitHub-Api-Version": "2026-03-10",
        "User-Agent": "Dispatch-GitHub-App",
      },
    });
    if (
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get("x-ratelimit-remaining") === "0" ||
          response.headers.has("retry-after")))
    ) {
      const seconds = Number(response.headers.get("retry-after")),
        reset = Number(response.headers.get("x-ratelimit-reset"));
      const delay = Math.max(
        Date.now() + 60000,
        Number.isFinite(seconds) && seconds > 0
          ? Date.now() + Math.min(seconds, 86400) * 1000
          : 0,
        Number.isFinite(reset) && reset > 0
          ? Math.min(reset * 1000, Date.now() + 86400000)
          : 0,
      );
      await response.body?.cancel();
      throw new RecoveryError("GITHUB_RATE_LIMITED", delay);
    }
    if (post) {
      await response.body?.cancel();
      if (response.status !== 202)
        throw new RecoveryError(
          response.status === 401 || response.status === 403
            ? "GITHUB_APP_PERMISSION_REQUIRED"
            : "GITHUB_REDELIVERY_OUTCOME_UNKNOWN",
        );
      return { data: null, next: null };
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new RecoveryError(
        response.status === 401 || response.status === 403
          ? "GITHUB_APP_PERMISSION_REQUIRED"
          : "GITHUB_PROVIDER_UNAVAILABLE",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
      }
      chunks.push(value);
    }
    let data: unknown;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
    }
    const link = response.headers.get("link") ?? "";
    let next: string | null = null;
    for (const part of link.split(","))
      if (/;\s*rel="next"/.test(part)) {
        const match = /^\s*<([^>]+)>/.exec(part);
        if (!match) throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
        const u = new URL(match[1]);
        if (
          u.origin !== "https://api.github.com" ||
          u.pathname !== "/app/hook/deliveries" ||
          u.username ||
          u.password ||
          u.hash ||
          !u.searchParams.get("cursor") ||
          u.searchParams.get("cursor")!.length > 1024
        )
          throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
        next = u.searchParams.get("cursor");
      }
    return { data, next };
  } catch (e) {
    if (e instanceof RecoveryError || e instanceof ConvexError) throw e;
    throw new RecoveryError(
      post
        ? "GITHUB_REDELIVERY_OUTCOME_UNKNOWN"
        : "GITHUB_PROVIDER_UNAVAILABLE",
    );
  } finally {
    clearTimeout(timer);
  }
}
export function deliveryMetadata(
  x: unknown,
): Infer<typeof observedDelivery> | null {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
  const d = x as Record<string, unknown>;
  const id = (n: unknown) => {
    if (typeof n !== "number" || !Number.isSafeInteger(n) || n <= 0)
      throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
    return String(n);
  };
  const deliveryId = id(d.id);
  if (
    typeof d.guid !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      d.guid,
    ) ||
    typeof d.delivered_at !== "string"
  )
    throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
  const deliveredAt = Date.parse(d.delivered_at);
  if (!Number.isFinite(deliveredAt) || deliveredAt > Date.now() + 60000)
    throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
  const providerStatus =
    d.status_code === null || d.status_code === undefined
      ? null
      : d.status_code;
  if (
    providerStatus !== null &&
    (typeof providerStatus !== "number" ||
      !Number.isInteger(providerStatus) ||
      providerStatus < 0 ||
      providerStatus > 599)
  )
    throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
  if (
    !["push", "release"].includes(String(d.event)) ||
    (d.event === "release" && d.action !== "published") ||
    d.installation_id === null ||
    d.repository_id === null
  )
    return null;
  return {
    deliveryId,
    guid: d.guid.toLowerCase(),
    event: d.event as "push" | "release",
    installationId: id(d.installation_id),
    providerId: id(d.repository_id),
    deliveredAt,
    providerStatus: providerStatus as number | null,
  };
}
async function scanPage(ctx: ActionCtx): Promise<null> {
  const claim = await ctx.runMutation(
    internal.integrations.github.recoveryState.scanClaim,
    {},
  );
  if (!claim) return null;
  try {
    const result = await deliveryRequest(
      "/app/hook/deliveries",
      token(),
      claim.cursor,
    );
    if (!Array.isArray(result.data) || result.data.length > 100)
      throw new RecoveryError("GITHUB_PROVIDER_RESPONSE_INVALID");
    const deliveries: Infer<typeof observedDelivery>[] = [];
    let oldestAt = claim.oldestAt,
      reachedWindow = false;
    for (const x of result.data) {
      const d = deliveryMetadata(x);
      if (!d) continue;
      oldestAt = Math.min(oldestAt ?? d.deliveredAt, d.deliveredAt);
      if (d.deliveredAt < claim.startedAt - 86400000) {
        reachedWindow = true;
        continue;
      }
      // Include no-response/null/zero and provider-success-without-local-receipt, not just the 400..599 failure filter.
      deliveries.push(d);
    }
    const next = reachedWindow ? null : result.next;
    await ctx.runMutation(
      internal.integrations.github.recoveryState.scanFinish,
      {
        sequence: claim.sequence,
        deliveries,
        cursor: next,
        oldestAt,
        limited:
          Boolean(next) ||
          (reachedWindow ? false : result.data.length === 100 && !result.next),
        notBefore: 0,
        errorCode: null,
      },
    );
  } catch (e) {
    const code =
      e instanceof RecoveryError
        ? e.code
        : e instanceof ConvexError &&
            String(e).includes("GITHUB_APP_PRIVATE_KEY_REQUIRED")
          ? "GITHUB_APP_PRIVATE_KEY_REQUIRED"
          : "GITHUB_PROVIDER_UNAVAILABLE";
    await ctx.runMutation(
      internal.integrations.github.recoveryState.scanFinish,
      {
        sequence: claim.sequence,
        deliveries: [],
        cursor: claim.cursor,
        oldestAt: claim.oldestAt,
        limited: true,
        notBefore:
          e instanceof RecoveryError && e.notBefore
            ? e.notBefore
            : Date.now() + 900000,
        errorCode: code,
      },
    );
  }
  return null;
}
export const scan = internalAction({
  args: {},
  returns: v.null(),
  handler: scanPage,
});
export const detect = action({
  args: workspaceArgs,
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    await ctx.runQuery(internal.integrations.github.recoveryState.authorize, a);
    return scanPage(ctx);
  },
});
export const redeliver = action({
  args: {
    ...workspaceArgs,
    recoveryId: v.id("githubRecoveries"),
    expectedGeneration: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    const local = await ctx.runQuery(
      internal.integrations.github.recoveryState.authorize,
      a,
    );
    const jwt = local ? null : token(); // Local signed facts need no provider key; missing remote configuration consumes no attempt.
    const r = await ctx.runMutation(
      internal.integrations.github.recoveryState.claim,
      a,
    );
    if (!r) return null;
    let accepted = false,
      code: string | null = null,
      notBefore = Date.now() + 900000;
    try {
      if (!jwt) throw new RecoveryError("GITHUB_REDELIVERY_OUTCOME_UNKNOWN");
      await ctx.runQuery(internal.integrations.github.recoveryState.scope, {
        workspaceId: a.workspaceId,
        recoveryId: r._id,
        sequence: r.sequence,
      });
      await deliveryRequest(
        `/app/hook/deliveries/${r.deliveryId}/attempts`,
        jwt,
      );
      accepted = true;
    } catch (e) {
      code =
        e instanceof RecoveryError
          ? e.code
          : String(e).includes("GITHUB_SOURCE_DISABLED")
            ? "GITHUB_SOURCE_DISABLED"
            : "GITHUB_REDELIVERY_OUTCOME_UNKNOWN";
      if (e instanceof RecoveryError)
        notBefore = Math.max(notBefore, e.notBefore);
    }
    await ctx.runMutation(internal.integrations.github.recoveryState.finish, {
      recoveryId: r._id,
      sequence: r.sequence,
      accepted,
      code,
      notBefore,
    });
    if (code) throw new ConvexError(code);
    return null;
  },
});
