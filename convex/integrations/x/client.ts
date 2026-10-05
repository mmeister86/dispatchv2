"use node";
import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import { api, internal } from "../../_generated/api";
import { keyring, open, seal, randomSecret, sha256 } from "../../lib/crypto";
import { association, accountArgs } from "./fields";

const SCOPES = [
  "tweet.read",
  "users.read",
  "tweet.write",
  "offline.access",
  "media.write",
];
export function configuration() {
  const clientId = process.env.X_CLIENT_ID,
    clientSecret = process.env.X_CLIENT_SECRET;
  let site: URL;
  try {
    site = new URL(process.env.SITE_URL ?? "");
  } catch {
    throw new ConvexError("X_CONFIGURATION_REQUIRED");
  }
  if (
    !clientId ||
    !clientSecret ||
    site.username ||
    site.password ||
    site.search ||
    site.hash ||
    site.pathname !== "/" ||
    (site.protocol !== "https:" &&
      !(
        site.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(site.hostname)
      ))
  )
    throw new ConvexError("X_CONFIGURATION_REQUIRED");
  keyring();
  return {
    clientId,
    clientSecret,
    redirectUri: new URL("/integrations/x/callback", site).href,
  };
}
export class ProviderError extends Error {
  constructor(
    public code:
      | "X_REAUTH_REQUIRED"
      | "X_PROVIDER_UNAVAILABLE"
      | "X_PROVIDER_RESPONSE_INVALID",
  ) {
    super(code);
  }
}
export async function request(
  path: "token" | "me",
  config: ReturnType<typeof configuration>,
  form?: URLSearchParams,
  token?: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(
      path === "token"
        ? "https://api.x.com/2/oauth2/token"
        : "https://api.x.com/2/users/me",
      {
        method: path === "token" ? "POST" : "GET",
        redirect: "error",
        signal: controller.signal,
        headers:
          path === "token"
            ? {
                Authorization: `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString("base64")}`,
                "Content-Type": "application/x-www-form-urlencoded",
              }
            : { Authorization: `Bearer ${token}` },
        ...(form ? { body: form.toString() } : {}),
      },
    );
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
      }
      chunks.push(value);
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
    if (!response.ok)
      throw new ProviderError(
        response.status === 401 ||
          response.status === 403 ||
          data.error === "invalid_grant"
          ? "X_REAUTH_REQUIRED"
          : "X_PROVIDER_UNAVAILABLE",
      );
    return data;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("X_PROVIDER_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}
export type Tokens = { accessToken: string; refreshToken?: string };
export function tokens(data: Record<string, unknown>, priorScopes?: string[]) {
  const validToken = (s: unknown): s is string =>
    typeof s === "string" &&
    s.length > 0 &&
    s.length <= 8192 &&
    !/[^\x21-\x7e]/.test(s);
  if (
    !validToken(data.access_token) ||
    String(data.token_type).toLowerCase() !== "bearer" ||
    typeof data.expires_in !== "number" ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    data.expires_in > 31536000 ||
    (data.refresh_token !== undefined && !validToken(data.refresh_token))
  )
    throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
  let scopes: string[];
  if (data.scope === undefined && priorScopes) scopes = priorScopes;
  else if (typeof data.scope === "string" && data.scope.length <= 2048)
    scopes = data.scope.split(" ").filter(Boolean);
  else throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
  if (
    scopes.length > 32 ||
    scopes.some((s) => !/^[a-z][a-z0-9._:-]{0,63}$/.test(s))
  )
    throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
  return {
    value: {
      accessToken: data.access_token,
      ...(data.refresh_token
        ? { refreshToken: data.refresh_token as string }
        : {}),
    } satisfies Tokens,
    scopes: [...new Set(scopes)],
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
export function identity(data: Record<string, unknown>) {
  const user = data.data as
    { id?: unknown; name?: unknown; username?: unknown } | undefined;
  if (
    !user ||
    typeof user.id !== "string" ||
    !/^\d{1,30}$/.test(user.id) ||
    typeof user.name !== "string" ||
    user.name.length < 1 ||
    user.name.length > 200 ||
    typeof user.username !== "string" ||
    !/^[a-zA-Z0-9_]{1,50}$/.test(user.username)
  )
    throw new ProviderError("X_PROVIDER_RESPONSE_INVALID");
  return { identity: user.id, name: user.name, handle: `@${user.username}` };
}
export const status = action({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    configured: v.boolean(),
    redirectUri: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{ configured: boolean; redirectUri: string | null }> => {
    await ctx.runQuery(api.integrations.x.oauth.authorize, a);
    try {
      return { configured: true, redirectUri: configuration().redirectUri };
    } catch {
      return { configured: false, redirectUri: null };
    }
  },
});
export const start = action({
  args: {
    workspaceId: v.id("workspaces"),
    accountId: v.optional(v.id("socialAccounts")),
  },
  returns: v.string(),
  handler: async (ctx, a): Promise<string> => {
    await ctx.runQuery(api.integrations.x.oauth.authorize, {
      workspaceId: a.workspaceId,
    });
    const config = configuration(),
      state = randomSecret(),
      verifier = randomSecret(),
      digest = await sha256(state);
    await ctx.runMutation(internal.integrations.x.oauth.reserve, {
      ...a,
      digest,
      verifier: await seal(verifier, `x-pkce:${a.workspaceId}:${digest}`),
      redirectUri: config.redirectUri,
    });
    const url = new URL("https://x.com/i/oauth2/authorize");
    url.search = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: SCOPES.join(" "),
      state,
      code_challenge: await sha256(verifier),
      code_challenge_method: "S256",
    }).toString();
    return url.href;
  },
});
export const callback = action({
  args: {
    workspaceId: v.id("workspaces"),
    state: v.string(),
    code: v.optional(v.string()),
    denied: v.boolean(),
  },
  returns: v.id("socialAccounts"),
  handler: async (ctx, a): Promise<Id<"socialAccounts">> => {
    if (
      !/^[a-zA-Z0-9_-]{43}$/.test(a.state) ||
      (!a.denied && (!a.code || a.code.length > 4096))
    )
      throw new ConvexError("X_OAUTH_STATE_INVALID");
    const config = configuration();
    const s = await ctx.runMutation(internal.integrations.x.oauth.claim, {
      workspaceId: a.workspaceId,
      digest: await sha256(a.state),
      denied: a.denied,
    });
    if (a.denied) throw new ConvexError("X_OAUTH_DENIED");
    try {
      if (s.redirectUri !== config.redirectUri)
        throw new ConvexError("X_CONFIGURATION_CHANGED");
      const verifier = await open<string>(
        s.verifier!,
        `x-pkce:${s.workspaceId}:${s.digest}`,
      );
      const result = tokens(
        await request(
          "token",
          config,
          new URLSearchParams({
            grant_type: "authorization_code",
            code: a.code!,
            redirect_uri: s.redirectUri,
            code_verifier: verifier,
          }),
        ),
      );
      const user = identity(
        await request("me", config, undefined, result.value.accessToken),
      );
      const claimed = await ctx.runMutation(
        internal.integrations.x.oauth.finish,
        { workspaceId: a.workspaceId, stateId: s._id, ...user },
      );
      await ctx.runMutation(internal.integrations.x.oauth.complete, {
        workspaceId: a.workspaceId,
        stateId: s._id,
        ...claimed,
        envelope: await seal(
          result.value,
          association(a.workspaceId, claimed.accountId),
        ),
        expiresAt: result.expiresAt,
        scopes: result.scopes,
      });
      return claimed.accountId;
    } catch (e) {
      await ctx.runMutation(internal.integrations.x.oauth.failState, {
        stateId: s._id,
      });
      if (e instanceof ConvexError) throw e;
      throw new ConvexError(
        e instanceof ProviderError ? e.code : "X_OAUTH_FAILED",
      );
    }
  },
});
export const refresh = action({
  args: accountArgs,
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    configuration();
    const claim = await ctx.runMutation(
      internal.integrations.x.oauth.refreshClaim,
      a,
    );
    if (!claim.credential) throw new ConvexError(claim.code!);
    const c = claim.credential;
    try {
      const value = await open<Tokens>(
        c.envelope!,
        association(a.workspaceId, a.accountId),
      );
      if (!value.refreshToken) throw new ProviderError("X_REAUTH_REQUIRED");
      const result = tokens(
        await request(
          "token",
          configuration(),
          new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: value.refreshToken,
          }),
        ),
        c.scopes,
      );
      // RFC6749 allows omission of a replacement refresh token; preserve the existing token only on a confirmed successful response.
      result.value.refreshToken ??= value.refreshToken;
      await ctx.runMutation(internal.integrations.x.oauth.refreshComplete, {
        ...a,
        generation: c.generation,
        envelope: await seal(
          result.value,
          association(a.workspaceId, a.accountId),
        ),
        expiresAt: result.expiresAt,
        scopes: result.scopes,
      });
      return null;
    } catch (e) {
      const code =
        e instanceof ConvexError &&
        ["X_ENCRYPTION_KEY_UNAVAILABLE", "X_CREDENTIAL_UNREADABLE"].includes(
          String(e.data),
        )
          ? (String(e.data) as
              "X_ENCRYPTION_KEY_UNAVAILABLE" | "X_CREDENTIAL_UNREADABLE")
          : e instanceof ProviderError && e.code === "X_REAUTH_REQUIRED"
            ? "X_REAUTH_REQUIRED"
            : "X_REFRESH_OUTCOME_UNKNOWN";
      await ctx.runMutation(internal.integrations.x.oauth.refreshFailed, {
        ...a,
        generation: c.generation,
        code,
      });
      if (
        e instanceof ConvexError &&
        [
          "X_CONNECTION_CHANGED",
          "X_WORKSPACE_CHANGED",
          "WORKSPACE_ACCESS_DENIED",
          "WORKSPACE_INACTIVE",
          "ROLE_ACCESS_DENIED",
        ].includes(String(e.data))
      )
        throw e;
      throw new ConvexError(code);
    }
  },
});

export const credentialForSchedule = internalAction({
  args: {
    scheduleId: v.id("schedules"),
    generation: v.number(),
    operation: v.union(v.literal("text"), v.literal("media")),
  },
  returns: v.object({
    accessToken: v.string(),
    credentialGeneration: v.number(),
    expiresAt: v.number(),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{
    accessToken: string;
    credentialGeneration: number;
    expiresAt: number;
  }> => {
    const c = await ctx.runQuery(
      internal.integrations.x.oauth.scheduleSource,
      a,
    );
    const value = await open<Tokens>(
      c.envelope!,
      association(c.workspaceId, c.accountId),
    );
    const current = await ctx.runQuery(
      internal.integrations.x.oauth.scheduleSource,
      a,
    );
    if (current.generation !== c.generation)
      throw new ConvexError("X_CONNECTION_CHANGED");
    return {
      accessToken: value.accessToken,
      credentialGeneration: c.generation,
      expiresAt: c.expiresAt,
    };
  },
});

// Concrete paused read access; ordinary publishing credentials keep their existing write guards.
export const credentialForReconciliation = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    scheduleId: v.id("schedules"),
    expectedGeneration: v.number(),
    position: v.number(),
    candidateId: v.string(),
    reconcileSequence: v.number(),
  },
  returns: v.object({
    accessToken: v.string(),
    credentialGeneration: v.number(),
    connectionSequence: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    accessToken: string;
    credentialGeneration: number;
    connectionSequence: number;
  }> => {
    const { reconcileSequence, ...a } = args;
    const src = await ctx.runQuery(internal.publishing.reconcile.source, a);
    if (
      src.attempt.stage !== "unknown" ||
      src.attempt.reconcileSequence !== reconcileSequence ||
      (src.attempt.reconcileLeaseUntil ?? 0) <= Date.now()
    )
      throw new ConvexError("X_RECONCILIATION_CHANGED");
    const value = await open<Tokens>(
      src.credential.envelope!,
      association(a.workspaceId, src.attempt.accountId),
    );
    const current = await ctx.runQuery(internal.publishing.reconcile.source, a);
    if (
      current.credential.generation !== src.credential.generation ||
      current.connectionSequence !== src.connectionSequence ||
      current.attempt._id !== src.attempt._id ||
      current.attempt.stage !== "unknown" ||
      current.attempt.reconcileSequence !== reconcileSequence ||
      (current.attempt.reconcileLeaseUntil ?? 0) <= Date.now()
    )
      throw new ConvexError("X_RECONCILIATION_CHANGED");
    return {
      accessToken: value.accessToken,
      credentialGeneration: src.credential.generation,
      connectionSequence: src.connectionSequence,
    };
  },
});
