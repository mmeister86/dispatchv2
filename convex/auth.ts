import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { APIError, getOAuthState } from "better-auth/api";
import {
  canonicalWrite,
  digest,
  requireAdmittedIdentity,
} from "./operations/authAdmission";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { query, type ActionCtx } from "./_generated/server";
import { v } from "convex/values";

export const authComponent = createClient<DataModel>(components.betterAuth);
export function authOrigins(siteUrl: string) {
  const url = new URL(siteUrl);
  const origins = [url.origin];
  if (["localhost", "127.0.0.1"].includes(url.hostname)) {
    url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
    origins.push(url.origin);
  }
  return origins;
}
async function sendEmail(to: string, subject: string, url: string) {
  if (!process.env.RESEND_API_KEY)
    throw new Error("Auth email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM ?? "Dispatch <onboarding@resend.dev>",
      to: [to],
      subject,
      text: `${subject}\n\n${url}\n\nFalls du dies nicht angefordert hast, ignoriere diese E-Mail.`,
    }),
  });
  if (!response.ok)
    throw new Error(`Auth email delivery failed (${response.status})`);
}
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl || !process.env.BETTER_AUTH_SECRET)
    throw new Error(
      "SITE_URL and BETTER_AUTH_SECRET must be configured on the Convex deployment",
    );
  type Lease = {
    id: Id<"authLeases">;
    generation: string;
    authId?: string;
    proven: boolean;
    expiresAt: number;
  };
  let lease: Lease | undefined;
  let requestPath = "";
  let keyValue: string | undefined;
  let observedAuthId: string | undefined;
  let observedSessionId: string | undefined;
  let requestState: string | undefined;
  const proofs = new Map<string, { authId?: string; allowed: boolean }[]>();
  const mutationCtx = ctx as ActionCtx;
  const deny = () =>
    new APIError("UNAUTHORIZED", { message: "AUTH_ADMISSION_DENIED" });
  const stage = async (
    model: string,
    operation: string,
    data: Record<string, unknown>,
    context: unknown,
  ) => {
    if (!lease) return;
    const endpoint = context as {
      path?: string;
      context?: { session?: { user?: { id?: string } } };
    } | null;
    const path = endpoint?.path ?? requestPath;
    const callback = path.startsWith("/callback/");
    let currentState = false;
    if (callback) {
      const state = await getOAuthState();
      currentState = !!state && state.oauthState === requestState;
    }
    let authId =
      typeof data.userId === "string"
        ? data.userId
        : endpoint?.context?.session?.user?.id;
    if (model === "user" && operation === "update" && path === "/verify-email")
      authId = lease.authId;
    let allowed = false;
    if (model === "user")
      allowed =
        operation === "create"
          ? path === "/sign-up/email" || currentState
          : path === "/verify-email"
            ? lease.proven && !!authId
            : currentState || !!authId;
    if (model === "account")
      allowed =
        currentState ||
        (data.providerId === "credential" &&
          ["/sign-up/email", "/reset-password"].includes(path)) ||
        (operation === "update" &&
          ["/reset-password", "/change-password", "/set-password"].includes(
            path,
          ));
    if (model === "session")
      allowed =
        currentState ||
        [
          "/sign-in/email",
          "/sign-up/email",
          "/verify-email",
          "/reset-password",
          "/get-session",
          "/update-session",
        ].includes(path);
    if (model === "verification") allowed = lease.proven;
    const key = canonicalWrite(model, operation, data);
    const queue = proofs.get(key) ?? [];
    queue.push({ authId, allowed });
    proofs.set(key, queue);
  };
  const adapterCtx =
    "runMutation" in ctx
      ? ({
          ...ctx,
          runQuery: async (reference: unknown, args: any) => {
            const result: any = await mutationCtx.runQuery(
              reference as never,
              args,
            );
            if (
              args?.model === "session" &&
              args.where?.some((where: any) => where.field === "token") &&
              result?._id &&
              result?.userId
            ) {
              observedAuthId = result.userId;
              observedSessionId = result._id;
            }
            return result;
          },
          runMutation: async (reference: unknown, args: any) => {
            const input = args?.input;
            if (!lease || !input || (!input.data && !input.update))
              return mutationCtx.runMutation(reference as never, args);
            const operation = input.data ? "create" : "update";
            const key = canonicalWrite(
              input.model,
              operation,
              input.data ?? input.update,
            );
            let proof = proofs.get(key)?.shift();
            if (!proof && operation === "update") {
              // The native adapter supplies updatedAt after the supported before hook.
              const { updatedAt, ...hookUpdate } = input.update;
              if (typeof updatedAt === "number")
                proof = proofs
                  .get(canonicalWrite(input.model, operation, hookUpdate))
                  ?.shift();
            }
            if (!proof)
              throw new APIError("UNAUTHORIZED", {
                message: "AUTH_NATIVE_WRITE_PROOF_MISMATCH",
              });
            const operationDigest = await digest(key, keyValue);
            const issue = async (target?: any) => {
              const authId =
                input.model === "user"
                  ? target?._id
                  : typeof input.data?.userId === "string"
                    ? input.data.userId
                    : target?.userId;
              if (proof.authId && authId && proof.authId !== authId)
                throw deny();
              const nonce = crypto.randomUUID();
              await mutationCtx.runMutation(
                internal.operations.authAdmission.issuePermit,
                {
                  leaseId: lease!.id,
                  nonce,
                  model: input.model,
                  operation,
                  operationDigest,
                  targetId: target?._id,
                  authId: proof.authId ?? authId,
                },
              );
              return nonce;
            };
            if (!proof.allowed) {
              // Unproven artifacts retain ordinary unrelated Auth semantics; fenced writes have no nonce.
              return mutationCtx.runMutation(reference as never, args);
            }
            let result: any;
            if (operation === "create") {
              result = await mutationCtx.runMutation(reference as never, {
                ...args,
                approvalNonce: await issue(),
              });
            } else if (args.paginationOpts) {
              const paginationOpts = {
                ...args.paginationOpts,
                numItems: Math.min(args.paginationOpts.numItems, 25),
              };
              const rows = await mutationCtx.runQuery(
                components.betterAuth.adapter.findMany,
                { model: input.model, where: input.where, paginationOpts },
              );
              const approvalNonces = [];
              for (const row of rows.page)
                approvalNonces.push({ id: row._id, nonce: await issue(row) });
              result = await mutationCtx.runMutation(reference as never, {
                ...args,
                paginationOpts,
                approvalNonces,
              });
            } else {
              const target = await mutationCtx.runQuery(
                components.betterAuth.adapter.findOne,
                { model: input.model, where: input.where },
              );
              result = await mutationCtx.runMutation(reference as never, {
                ...args,
                approvalNonce: target ? await issue(target) : undefined,
              });
            }
            if (result === null) throw deny();
            return result;
          },
        } as GenericCtx<DataModel>)
      : ctx;
  const before =
    (model: string, operation: string) =>
    async (data: Record<string, unknown>, context: unknown) => {
      await stage(model, operation, data, context);
      return { data };
    };
  const auth = betterAuth({
    baseURL: process.env.CONVEX_SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(adapterCtx),
    databaseHooks: {
      user: {
        create: { before: before("user", "create") },
        update: { before: before("user", "update") },
      },
      account: {
        create: { before: before("account", "create") },
        update: { before: before("account", "update") },
      },
      session: {
        create: { before: before("session", "create") },
        update: { before: before("session", "update") },
      },
      verification: {
        create: { before: before("verification", "create") },
        update: { before: before("verification", "update") },
      },
    },
    trustedOrigins: authOrigins(siteUrl),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail(user.email, "Dispatch: Passwort zurücksetzen", url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url, token }) => {
        if (lease) {
          const payload = JSON.parse(
            atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
          );
          if (
            typeof payload.iat !== "number" ||
            typeof payload.exp !== "number"
          )
            throw deny();
          await mutationCtx.runMutation(
            internal.operations.authAdmission.recordEmailIssuance,
            {
              leaseId: lease.id,
              authId: user.id,
              tokenDigest: await digest(token, keyValue),
              issuedAt: payload.iat * 1000,
              expiresAt: payload.exp * 1000,
            },
          );
        }
        await sendEmail(user.email, "Dispatch: E-Mail bestätigen", url);
      },
    },
    socialProviders:
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
        ? {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID,
              clientSecret: process.env.GITHUB_CLIENT_SECRET,
              scope: ["read:user", "user:email"],
            },
          }
        : {},
    plugins: [convex({ authConfig }), crossDomain({ siteUrl })],
  });
  const nativeHandler = auth.handler;
  return {
    ...auth,
    handler: async (request: Request) => {
      const health = await mutationCtx.runQuery(
        components.betterAuth.guard.health,
        {},
      );
      if (!health.configured) return nativeHandler(request);
      keyValue = await mutationCtx.runQuery(
        internal.operations.authAdmission.admissionKey,
        {},
      );
      const url = new URL(request.url);
      requestPath = url.pathname.replace(/^\/api\/auth/, "");
      requestState = url.searchParams.get("state") ?? undefined;
      let source = "current";
      let artifact: string | undefined;
      if (requestPath === "/verify-email") {
        source = "jwt";
        artifact = url.searchParams.get("token") ?? undefined;
      } else if (requestPath.startsWith("/callback/")) {
        source = "state";
        if (!requestState && request.method === "POST") {
          const body = await request.clone().formData();
          requestState = String(body.get("state") ?? "") || undefined;
        }
        artifact = requestState;
      } else if (
        requestPath === "/reset-password" ||
        [
          "/one-time-token/verify",
          "/cross-domain/one-time-token/verify",
        ].includes(requestPath)
      ) {
        const body = await request
          .clone()
          .json()
          .catch(() => ({}));
        source = requestPath === "/reset-password" ? "reset" : "ott";
        if (typeof body.token === "string")
          artifact = `${source === "reset" ? "reset-password" : "one-time-token"}:${body.token}`;
      }
      lease = await mutationCtx.runMutation(
        internal.operations.authAdmission.beginLease,
        {
          path: requestPath,
          source,
          sourceDigest: artifact ? await digest(artifact, keyValue) : undefined,
        },
      );
      const response = await nativeHandler(request);
      let responseAuthId = observedAuthId;
      let responseSessionId = observedSessionId;
      if (response.headers.get("content-type")?.includes("application/json")) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        responseAuthId =
          typeof body?.user?.id === "string" ? body.user.id : responseAuthId;
        responseSessionId =
          typeof body?.session?.id === "string"
            ? body.session.id
            : responseSessionId;
        if (
          typeof body?.token === "string" &&
          body.token.split(".").length === 3
        ) {
          try {
            const payload = JSON.parse(
              atob(
                body.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"),
              ),
            );
            if (typeof payload.sub === "string") responseAuthId = payload.sub;
            if (typeof payload.sessionId === "string")
              responseSessionId = payload.sessionId;
          } catch {
            throw deny();
          }
        }
      }
      const publish = await mutationCtx.runMutation(
        internal.operations.authAdmission.finishLease,
        { leaseId: lease!.id, responseAuthId, responseSessionId },
      );
      return publish
        ? response
        : new Response(JSON.stringify({ code: "AUTH_REQUEST_REVOKED" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
    },
  };
};
export const capabilities = query({
  args: {},
  returns: v.object({
    githubLogin: v.boolean(),
    emailDelivery: v.boolean(),
    restrictedSender: v.boolean(),
  }),
  handler: () => ({
    githubLogin: !!(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ),
    emailDelivery: !!process.env.RESEND_API_KEY,
    restrictedSender: !process.env.AUTH_EMAIL_FROM,
  }),
});

export const session = query({
  args: {},
  returns: v.object({ id: v.string(), emailVerified: v.boolean() }),
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    await requireAdmittedIdentity(ctx, user._id);
    return { id: user._id, emailVerified: user.emailVerified };
  },
});
