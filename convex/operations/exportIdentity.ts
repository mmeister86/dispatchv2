import { ConvexError, v } from "convex/values";
import { workspaceQuery } from "../lib/authorization";
import { components } from "../_generated/api";
import { role } from "../schema";

const string = v.optional(v.union(v.string(), v.null()));
const number = v.optional(v.union(v.number(), v.null()));
const boolean = v.optional(v.union(v.boolean(), v.null()));
const models = [
  "user",
  "session",
  "account",
  "oauthApplication",
  "oauthConsent",
  "oauthAccessToken",
] as const;
const model = v.union(...models.map(v.literal));
const fields = {
  name: string,
  email: string,
  emailVerified: boolean,
  image: string,
  createdAt: number,
  updatedAt: number,
  twoFactorEnabled: boolean,
  isAnonymous: boolean,
  username: string,
  displayUsername: string,
  phoneNumber: string,
  phoneNumberVerified: boolean,
  expiresAt: number,
  ipAddress: string,
  userAgent: string,
  providerId: string,
  accountId: string,
  scope: string,
  accessTokenExpiresAt: number,
  refreshTokenExpiresAt: number,
  icon: string,
  clientId: string,
  redirectUrls: string,
  type: string,
  disabled: boolean,
  scopes: string,
  consentGiven: boolean,
};
const keys: Record<(typeof models)[number], (keyof typeof fields)[]> = {
  user: [
    "name",
    "email",
    "emailVerified",
    "image",
    "createdAt",
    "updatedAt",
    "twoFactorEnabled",
    "isAnonymous",
    "username",
    "displayUsername",
    "phoneNumber",
    "phoneNumberVerified",
  ],
  session: ["createdAt", "updatedAt", "expiresAt", "ipAddress", "userAgent"],
  account: [
    "providerId",
    "accountId",
    "scope",
    "createdAt",
    "updatedAt",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
  ],
  oauthApplication: [
    "name",
    "icon",
    "clientId",
    "redirectUrls",
    "type",
    "disabled",
    "createdAt",
    "updatedAt",
  ],
  oauthConsent: [
    "clientId",
    "scopes",
    "createdAt",
    "updatedAt",
    "consentGiven",
  ],
  oauthAccessToken: [
    "clientId",
    "scopes",
    "accessTokenExpiresAt",
    "refreshTokenExpiresAt",
    "createdAt",
    "updatedAt",
  ],
};
const metadata = v.object(fields);
export const page = workspaceQuery({
  args: {
    model,
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    cursor: v.union(v.string(), v.null()),
    creationUpperBound: v.union(v.number(), v.null()),
  },
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    workspaceId: v.id("workspaces"),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    creationUpperBound: v.number(),
    observedAt: v.number(),
    role,
    proofValidUntil: v.number(),
    data: v.object({
      format: v.literal("dispatch-own-identity"),
      version: v.literal(1),
      model,
      rows: v.array(v.object({ recordId: v.string(), data: metadata })),
      excluded: v.array(v.string()),
    }),
  }),
  handler: async (ctx, a) => {
    const claims = await ctx.auth.getUserIdentity();
    if (
      a.expectedAuthId !== ctx.user.authId ||
      a.expectedSessionId !== claims?.sessionId ||
      ctx.user.activeWorkspaceId !== ctx.workspace._id
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    if (
      !a.requestKey ||
      a.requestKey.length > 64 ||
      (a.cursor !== null && (!a.cursor || a.cursor.length > 16384)) ||
      (a.cursor === null) !== (a.creationUpperBound === null)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const observedAt = Date.now(),
      bound = a.creationUpperBound ?? observedAt;
    if (!Number.isFinite(bound) || bound < 0 || bound > observedAt)
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const projection = [
      "_id",
      "_creationTime",
      ...(a.model === "user" ? [] : ["userId"]),
      ...keys[a.model],
    ];
    const p = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: a.model,
      where: [
        {
          field: a.model === "user" ? "_id" : "userId",
          operator: "eq",
          value: ctx.user.authId,
        },
      ],
      select: projection,
      paginationOpts: { cursor: a.cursor, numItems: 1 },
    });
    const rows: {
      recordId: string;
      data: Record<string, string | number | boolean | null>;
    }[] = [];
    for (const r of p.page) {
      const row = r as Record<string, unknown>;
      if (
        (a.model === "user" ? row._id : row.userId) !== ctx.user.authId ||
        typeof row._id !== "string" ||
        typeof row._creationTime !== "number" ||
        !Number.isFinite(row._creationTime)
      )
        throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
      if (row._creationTime > bound) continue;
      const data: Record<string, string | number | boolean | null> = {};
      for (const key of keys[a.model]) {
        const value = row[key];
        if (value === undefined) continue;
        if (
          value !== null &&
          typeof value !== "string" &&
          typeof value !== "boolean" &&
          typeof value !== "number"
        )
          throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
        if (typeof value === "number" && !Number.isFinite(value))
          throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
        data[key] = value;
      }
      rows.push({ recordId: row._id, data });
    }
    const result = {
      authId: ctx.user.authId,
      sessionId: a.expectedSessionId,
      requestKey: a.requestKey,
      workspaceId: ctx.workspace._id,
      cursor: p.isDone ? null : p.continueCursor,
      isDone: p.isDone,
      creationUpperBound: bound,
      observedAt,
      role: ctx.membership.role,
      proofValidUntil: observedAt + 30000,
      data: {
        format: "dispatch-own-identity" as const,
        version: 1 as const,
        model: a.model,
        rows,
        excluded: [
          "passwords",
          "bearer_tokens",
          "client_secrets",
          "arbitrary_application_metadata",
          "verification_secrets",
          "two_factor_secrets",
          "global_jwks",
          "global_rate_limits",
        ],
      },
    };
    if (new TextEncoder().encode(JSON.stringify(result)).length > 64 * 1024)
      throw new ConvexError("EXPORT_DATA_UNAVAILABLE");
    return result;
  },
});
