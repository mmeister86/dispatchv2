"use node";
import { createPrivateKey, sign } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../../_generated/server";
import type { ActionCtx } from "../../_generated/server";
import { api, internal } from "../../_generated/api";
import type { Id, Doc } from "../../_generated/dataModel";
import { keyring, seal, open, randomSecret, sha256 } from "../../lib/crypto";
import { association, workspaceArgs, repository, installation } from "./fields";
const API_VERSION = "2026-03-10";
export function configuration() {
  const clientId = process.env.GITHUB_APP_CLIENT_ID,
    clientSecret = process.env.GITHUB_APP_CLIENT_SECRET,
    appId = process.env.GITHUB_APP_ID;
  let site: URL;
  try {
    site = new URL(process.env.SITE_URL ?? "");
  } catch {
    throw new ConvexError("GITHUB_CONFIGURATION_REQUIRED");
  }
  if (
    !clientId ||
    !clientSecret ||
    !appId ||
    !/^\d{1,19}$/.test(appId) ||
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
    throw new ConvexError("GITHUB_CONFIGURATION_REQUIRED");
  keyring();
  return {
    clientId,
    clientSecret,
    appId,
    redirectUri: new URL("/integrations/github/callback", site).href,
  };
}
class ProviderError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function request(
  path: string,
  token: string,
  form?: URLSearchParams,
  body?: unknown,
  page = 1,
): Promise<Record<string, unknown>> {
  if (
    !/^\/(user(?:\/installations(?:\/\d{1,19}\/repositories)?)?|app\/installations\/\d{1,19}\/access_tokens)$/.test(
      path,
    ) &&
    path !== "/login/oauth/access_token"
  )
    throw new ProviderError("GITHUB_PROVIDER_ENDPOINT_INVALID");
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 15000);
  try {
    const oauth = path === "/login/oauth/access_token";
    const response = await fetch(
      `${oauth ? "https://github.com" : "https://api.github.com"}${path}${!oauth && path !== "/user" && !body ? "?per_page=100&page=" + page : ""}`,
      {
        method: form || body ? "POST" : "GET",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...(oauth
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {
                Authorization: `Bearer ${token}`,
                "X-GitHub-Api-Version": API_VERSION,
                "User-Agent": "Dispatch-GitHub-App",
                ...(body ? { "Content-Type": "application/json" } : {}),
              }),
        },
        ...(form
          ? { body: form.toString() }
          : body
            ? { body: JSON.stringify(body) }
            : {}),
      },
    );
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      throw new ProviderError("GITHUB_REAUTH_REQUIRED");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) {
        await reader.cancel();
        throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
      }
      chunks.push(value);
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
    if (!response.ok || data.error)
      throw new ProviderError(
        response.status === 401 ||
          response.status === 403 ||
          data.error === "bad_verification_code" ||
          data.error === "incorrect_client_credentials"
          ? "GITHUB_REAUTH_REQUIRED"
          : response.status === 429
            ? "GITHUB_RATE_LIMITED"
            : "GITHUB_PROVIDER_UNAVAILABLE",
      );
    return data;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("GITHUB_PROVIDER_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}
export type Tokens = { accessToken: string; refreshToken?: string };
export function tokens(d: Record<string, unknown>) {
  const valid = (s: unknown): s is string =>
    typeof s === "string" &&
    s.length > 0 &&
    s.length <= 8192 &&
    !/[^\x21-\x7e]/.test(s);
  const expiry = (x: unknown) =>
    typeof x === "number" && Number.isSafeInteger(x) && x > 0 && x <= 31536000;
  if (
    !valid(d.access_token) ||
    String(d.token_type).toLowerCase() !== "bearer" ||
    d.scope !== "" ||
    (d.expires_in !== undefined && !expiry(d.expires_in)) ||
    (d.refresh_token !== undefined &&
      (!valid(d.refresh_token) || !expiry(d.refresh_token_expires_in))) ||
    (d.expires_in !== undefined && d.refresh_token === undefined) ||
    (d.refresh_token !== undefined && d.expires_in === undefined)
  )
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  return {
    value: {
      accessToken: d.access_token,
      ...(d.refresh_token ? { refreshToken: d.refresh_token as string } : {}),
    } satisfies Tokens,
    expiresAt:
      d.expires_in === undefined
        ? Number.MAX_SAFE_INTEGER
        : Date.now() + (d.expires_in as number) * 1000,
    refreshExpiresAt:
      d.refresh_token === undefined
        ? 0
        : Date.now() + (d.refresh_token_expires_in as number) * 1000,
  };
}
function id(x: unknown) {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x <= 0)
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  return String(x);
}
function login(x: unknown) {
  if (typeof x !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(x))
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  return x;
}
async function installations(
  token: string,
  config: ReturnType<typeof configuration>,
) {
  const d = await request("/user/installations", token);
  if (
    !Array.isArray(d.installations) ||
    d.installations.length > 100 ||
    typeof d.total_count !== "number" ||
    !Number.isSafeInteger(d.total_count) ||
    d.total_count < d.installations.length
  )
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  const result = d.installations
    .filter((raw) => {
      const x = raw as Record<string, unknown>;
      return String(x.app_id) === config.appId && x.suspended_at === null;
    })
    .map((raw) => {
      const x = raw as Record<string, unknown>,
        a = x.account as Record<string, unknown>;
      if (!a || !["User", "Organization"].includes(String(a.type)))
        throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
      return {
        id: id(x.id),
        owner: login(a.login),
        kind: a.type as "User" | "Organization",
      };
    });
  if (new Set(result.map((i) => i.id)).size !== result.length)
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  return { installations: result, inventoryLimited: d.total_count > 100 };
}
function repo(raw: unknown, installationId: string) {
  const x = raw as Record<string, unknown>,
    owner = x?.owner as Record<string, unknown>,
    permissions = x?.permissions as Record<string, unknown>;
  if (
    !x ||
    typeof x.private !== "boolean" ||
    !owner ||
    typeof x.name !== "string" ||
    !/^[a-zA-Z0-9_.-]{1,100}$/.test(x.name) ||
    x.full_name !== `${login(owner.login)}/${x.name}` ||
    permissions?.pull !== true
  )
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  return {
    providerId: id(x.id),
    installationId,
    fullName: String(x.full_name),
    private: x.private,
  };
}
async function inventory(token: string, installationId: string) {
  const rows: ReturnType<typeof repo>[] = [];
  let complete = false;
  const deadline = Date.now() + 120000;
  for (let page = 1; page <= 10; page++) {
    if (Date.now() > deadline)
      throw new ProviderError("GITHUB_PROVIDER_UNAVAILABLE");
    const d = await request(
      `/user/installations/${installationId}/repositories`,
      token,
      undefined,
      undefined,
      page,
    );
    if (
      !Array.isArray(d.repositories) ||
      d.repositories.length > 100 ||
      typeof d.total_count !== "number" ||
      !Number.isSafeInteger(d.total_count) ||
      d.total_count < 0
    )
      throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
    rows.push(...d.repositories.map((r) => repo(r, installationId)));
    if (d.repositories.length < 100) {
      complete = true;
      break;
    }
  }
  if (new Set(rows.map((r) => r.providerId)).size !== rows.length)
    throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
  return { repositories: rows, complete };
}
export function appJwt(config: ReturnType<typeof configuration>) {
  try {
    const pem = process.env.GITHUB_APP_PRIVATE_KEY;
    if (!pem || pem.length > 32768) throw Error();
    const key = createPrivateKey(pem);
    if (
      key.asymmetricKeyType !== "rsa" ||
      (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    )
      throw Error();
    const now = Math.floor(Date.now() / 1000),
      head = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
        "base64url",
      ),
      body = Buffer.from(
        JSON.stringify({ iat: now - 60, exp: now + 600, iss: config.clientId }),
      ).toString("base64url"),
      input = `${head}.${body}`;
    return `${input}.${sign("RSA-SHA256", Buffer.from(input), key).toString("base64url")}`;
  } catch {
    throw new ConvexError("GITHUB_APP_PRIVATE_KEY_REQUIRED");
  }
}
export const status = action({
  args: workspaceArgs,
  returns: v.object({
    configured: v.boolean(),
    installationConfigured: v.boolean(),
    redirectUri: v.union(v.string(), v.null()),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{
    configured: boolean;
    installationConfigured: boolean;
    redirectUri: string | null;
  }> => {
    await ctx.runQuery(api.integrations.github.repositories.authorize, a);
    try {
      const config = configuration();
      let ready = false;
      try {
        appJwt(config);
        ready = true;
      } catch {
        /* Presence/validity only; no provider request. */
      }
      return {
        configured: true,
        installationConfigured: ready,
        redirectUri: config.redirectUri,
      };
    } catch {
      return {
        configured: false,
        installationConfigured: false,
        redirectUri: null,
      };
    }
  },
});
export const start = action({
  args: workspaceArgs,
  returns: v.string(),
  handler: async (ctx, a): Promise<string> => {
    await ctx.runQuery(api.integrations.github.repositories.authorize, a);
    const config = configuration(),
      state = randomSecret(),
      verifier = randomSecret(),
      digest = await sha256(state);
    await ctx.runMutation(internal.integrations.github.repositories.reserve, {
      ...a,
      digest,
      verifier: await seal(verifier, `github-pkce:${a.workspaceId}:${digest}`),
      redirectUri: config.redirectUri,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      state,
      code_challenge: await sha256(verifier),
      code_challenge_method: "S256",
    }).toString();
    return url.href;
  },
});
export const callback = action({
  args: {
    ...workspaceArgs,
    state: v.string(),
    code: v.optional(v.string()),
    denied: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    if (
      !/^[a-zA-Z0-9_-]{43}$/.test(a.state) ||
      (!a.denied && (!a.code || a.code.length > 4096))
    )
      throw new ConvexError("GITHUB_OAUTH_STATE_INVALID");
    const config = configuration(),
      s = await ctx.runMutation(
        internal.integrations.github.repositories.claim,
        {
          workspaceId: a.workspaceId,
          digest: await sha256(a.state),
          denied: a.denied,
        },
      );
    if (a.denied) throw new ConvexError("GITHUB_OAUTH_DENIED");
    try {
      if (s.redirectUri !== config.redirectUri)
        throw new ConvexError("GITHUB_CONFIGURATION_CHANGED");
      const verifier = await open<string>(
          s.verifier!,
          `github-pkce:${a.workspaceId}:${s.digest}`,
        ),
        result = tokens(
          await request(
            "/login/oauth/access_token",
            "",
            new URLSearchParams({
              client_id: config.clientId,
              client_secret: config.clientSecret,
              code: a.code!,
              redirect_uri: s.redirectUri,
              code_verifier: verifier,
            }),
          ),
        );
      const user = await request("/user", result.value.accessToken),
        proof = await installations(result.value.accessToken, config);
      if (!proof.installations.length)
        throw new ConvexError("GITHUB_APP_ACCESS_REQUIRED");
      await ctx.runMutation(
        internal.integrations.github.repositories.complete,
        {
          workspaceId: a.workspaceId,
          stateId: s._id,
          identity: id(user.id),
          login: login(user.login),
          ...proof,
          envelope: await seal(result.value, association(a.workspaceId)),
          expiresAt: result.expiresAt,
          refreshExpiresAt: result.refreshExpiresAt,
        },
      );
      return null;
    } catch (e) {
      await ctx.runMutation(
        internal.integrations.github.repositories.failState,
        { workspaceId: a.workspaceId, stateId: s._id },
      );
      throw e instanceof ConvexError
        ? e
        : new ConvexError(
            e instanceof ProviderError ? e.code : "GITHUB_OAUTH_FAILED",
          );
    }
  },
});
async function credential(ctx: ActionCtx, workspaceId: Id<"workspaces">) {
  const c: Doc<"githubConnections"> = await ctx.runQuery(
    internal.integrations.github.repositories.credential,
    { workspaceId },
  );
  if (c.leaseUntil || c.expiresAt <= Date.now() + 30000)
    throw new ConvexError("GITHUB_REAUTH_REQUIRED");
  try {
    return {
      connection: c,
      value: await open<Tokens>(c.envelope!, association(workspaceId)),
    };
  } catch (e) {
    await ctx.runMutation(internal.integrations.github.repositories.block, {
      workspaceId,
      generation: c.generation,
      credentialGeneration: c.credentialGeneration,
      code: "GITHUB_CREDENTIAL_UNREADABLE",
    });
    throw e;
  }
}
async function discover(
  ctx: ActionCtx,
  a: {
    workspaceId: Id<"workspaces">;
    installationId: string;
    repositoryId?: string;
  },
) {
  if (
    !/^\d{1,19}$/.test(a.installationId) ||
    (a.repositoryId && !/^\d{1,19}$/.test(a.repositoryId))
  )
    throw new ConvexError("GITHUB_INSTALLATION_DENIED");
  const config = configuration(),
    c = await credential(ctx, a.workspaceId);
  const observed = await ctx.runMutation(
    internal.integrations.github.repositories.beginDiscovery,
    {
      workspaceId: a.workspaceId,
      generation: c.connection.generation,
      credentialGeneration: c.connection.credentialGeneration,
      selectId: a.repositoryId,
      installationId: a.installationId,
    },
  );
  try {
    const user = await request("/user", c.value.accessToken);
    if (id(user.id) !== c.connection.identity)
      throw new ProviderError("GITHUB_REAUTH_REQUIRED");
    const proof = await installations(c.value.accessToken, config);
    await ctx.runMutation(
      internal.integrations.github.repositories.installationProof,
      {
        workspaceId: a.workspaceId,
        generation: c.connection.generation,
        credentialGeneration: c.connection.credentialGeneration,
        syncSequence: observed.syncSequence,
        ...proof,
      },
    );
    if (!proof.installations.some((i) => i.id === a.installationId))
      throw new ConvexError("GITHUB_INSTALLATION_DENIED");
    const result = await inventory(c.value.accessToken, a.installationId);
    if (
      a.repositoryId &&
      !result.repositories.some((r) => r.providerId === a.repositoryId)
    )
      throw new ConvexError("GITHUB_REPOSITORY_DENIED");
    await ctx.runMutation(internal.integrations.github.repositories.verify, {
      workspaceId: a.workspaceId,
      generation: c.connection.generation,
      credentialGeneration: c.connection.credentialGeneration,
      installationId: a.installationId,
      ...result,
      selectId: a.repositoryId,
      ...observed,
    });
    return result;
  } catch (e) {
    if (e instanceof ProviderError && e.code === "GITHUB_REAUTH_REQUIRED")
      await ctx.runMutation(internal.integrations.github.repositories.block, {
        workspaceId: a.workspaceId,
        generation: c.connection.generation,
        credentialGeneration: c.connection.credentialGeneration,
        code: e.code,
      });
    throw e instanceof ConvexError
      ? e
      : new ConvexError(
          e instanceof ProviderError ? e.code : "GITHUB_PROVIDER_UNAVAILABLE",
        );
  }
}
export const discoverRepositories = action({
  args: { ...workspaceArgs, installationId: v.string() },
  returns: v.object({
    repositories: v.array(repository),
    complete: v.boolean(),
  }),
  handler: async (
    ctx,
    a,
  ): Promise<{ repositories: ReturnType<typeof repo>[]; complete: boolean }> =>
    discover(ctx, a),
});
export const select = action({
  args: {
    ...workspaceArgs,
    installationId: v.string(),
    repositoryId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    await discover(ctx, a);
    return null;
  },
});
export const refresh = action({
  args: workspaceArgs,
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    const config = configuration(),
      claim = await ctx.runMutation(
        internal.integrations.github.repositories.refreshClaim,
        a,
      );
    if (!claim.connection) throw new ConvexError(claim.code!);
    const c = claim.connection;
    try {
      const value = await open<Tokens>(c.envelope!, association(a.workspaceId));
      if (!value.refreshToken || c.refreshExpiresAt <= Date.now() + 30000)
        throw new ProviderError("GITHUB_REAUTH_REQUIRED");
      const result = tokens(
        await request(
          "/login/oauth/access_token",
          "",
          new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: "refresh_token",
            refresh_token: value.refreshToken,
          }),
        ),
      );
      if (
        !result.value.refreshToken ||
        result.value.refreshToken === value.refreshToken ||
        result.value.accessToken === value.accessToken
      )
        throw new ProviderError("GITHUB_PROVIDER_RESPONSE_INVALID");
      await ctx.runMutation(
        internal.integrations.github.repositories.refreshed,
        {
          ...a,
          generation: c.generation,
          credentialGeneration: c.credentialGeneration,
          envelope: await seal(result.value, association(a.workspaceId)),
          expiresAt: result.expiresAt,
          refreshExpiresAt: result.refreshExpiresAt,
        },
      );
      return null;
    } catch (e) {
      const code =
        e instanceof ProviderError && e.code === "GITHUB_REAUTH_REQUIRED"
          ? e.code
          : "GITHUB_REFRESH_OUTCOME_UNKNOWN";
      await ctx.runMutation(internal.integrations.github.repositories.block, {
        ...a,
        generation: c.generation,
        credentialGeneration: c.credentialGeneration,
        code,
      });
      throw new ConvexError(code);
    }
  },
});
// Narrow internal token for the exact current selected source; App-wide installation access never leaves this action.
export const installationCredential = internalAction({
  args: {
    ...workspaceArgs,
    repositoryId: v.id("githubRepositories"),
    generation: v.number(),
    purpose: v.union(v.literal("monitoring"), v.literal("content")),
  },
  returns: v.object({ token: v.string(), expiresAt: v.number() }),
  handler: async (ctx, a): Promise<{ token: string; expiresAt: number }> => {
    const source = await ctx.runQuery(
        internal.integrations.github.repositories.source,
        a,
      ),
      config = configuration();
    const result = await request(
      `/app/installations/${source.installationId}/access_tokens`,
      appJwt(config),
      undefined,
      {
        repository_ids: [Number(source.providerId)],
        permissions: { metadata: "read" },
      },
    );
    if (
      typeof result.token !== "string" ||
      !/^[\x21-\x7e]{1,8192}$/.test(result.token) ||
      typeof result.expires_at !== "string" ||
      !result.permissions ||
      typeof result.permissions !== "object" ||
      Array.isArray(result.permissions) ||
      Object.keys(result.permissions).length !== 1 ||
      (result.permissions as Record<string, unknown>).metadata !== "read" ||
      !Array.isArray(result.repositories) ||
      result.repositories.length !== 1 ||
      String((result.repositories[0] as Record<string, unknown>).id) !==
        source.providerId
    )
      throw new ConvexError("GITHUB_PROVIDER_RESPONSE_INVALID");
    const expiresAt = Date.parse(result.expires_at);
    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() + 30000 ||
      expiresAt > Date.now() + 3600000 + 60000
    )
      throw new ConvexError("GITHUB_PROVIDER_RESPONSE_INVALID");
    await ctx.runQuery(internal.integrations.github.repositories.source, a);
    return { token: result.token, expiresAt };
  },
});
