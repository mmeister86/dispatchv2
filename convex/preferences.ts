import { ConvexError, v, type Infer } from "convex/values";
import {
  profile,
  notificationPreference,
  personalNotificationSettings,
} from "./schema";
import {
  workspaceMutation,
  workspaceQuery,
  requireRole,
  requireReference,
} from "./lib/authorization";
export const save = workspaceMutation({
  args: {
    profile,
    project: v.optional(
      v.object({ name: v.string(), description: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireRole(ctx.membership, ["Owner", "Admin", "Editor"]);
    const p = args.profile;
    if (
      !p.name.trim() ||
      p.name.length > 100 ||
      p.audience.length > 4000 ||
      p.topics.length > 4000 ||
      p.tone.length > 500 ||
      !Number.isInteger(p.onboardingStep) ||
      p.onboardingStep < 0 ||
      p.onboardingStep > 3
    )
      throw new ConvexError("INVALID_PROFILE");
    try {
      new Intl.DateTimeFormat("en", { timeZone: p.timezone });
    } catch {
      throw new ConvexError("INVALID_TIMEZONE");
    }
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
      )
      .unique();
    requireReference(ctx.workspace._id, existing);
    if (args.project) {
      requireRole(ctx.membership, ["Owner", "Admin"]);
      if (
        !args.project.name.trim() ||
        args.project.name.length > 100 ||
        args.project.description.length > 2000
      )
        throw new ConvexError("INVALID_WORKSPACE");
      await ctx.db.patch(ctx.workspace._id, {
        name: args.project.name.trim(),
        description: args.project.description.trim(),
      });
    }
    await ctx.db.patch(existing!._id, { ...p, name: p.name.trim() });
    return null;
  },
});

import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
const notificationArgs = { expectedAuthId: v.string(), requestKey: v.string() };
const notificationResult = v.object({
  authId: v.string(),
  sessionId: v.string(),
  workspaceId: v.id("workspaces"),
  requestKey: v.string(),
  settings: personalNotificationSettings,
});
type Intent = Infer<typeof notificationPreference>;
function intent(s: Intent): Intent {
  return {
    email: s.email,
    inAppSummaries: s.inAppSummaries,
    weekly: s.weekly,
    research: s.research,
    timezone: s.timezone,
    quiet: s.quiet === null ? null : { start: s.quiet.start, end: s.quiet.end },
  };
}
function validateIntent(s: Intent) {
  if (!s.timezone || s.timezone.length > 100)
    throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
  try {
    const zone = new Intl.DateTimeFormat("en", {
      timeZone: s.timezone,
    }).resolvedOptions().timeZone;
    if (/^[+-]/.test(zone))
      throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
  } catch {
    throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
  }
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (
    s.quiet &&
    (!clock.test(s.quiet.start) ||
      !clock.test(s.quiet.end) ||
      s.quiet.start === s.quiet.end)
  )
    throw new ConvexError("INVALID_NOTIFICATION_SETTINGS");
}
async function ownNotificationRow(
  ctx: (QueryCtx | MutationCtx) & {
    user: Doc<"users">;
    workspace: Doc<"workspaces">;
  },
  a: { expectedAuthId: string; requestKey: string },
) {
  if (
    !a.requestKey ||
    a.requestKey.length > 64 ||
    !a.expectedAuthId ||
    a.expectedAuthId.length > 256
  )
    throw new ConvexError("NOTIFICATION_REQUEST_INVALID");
  if (
    ctx.user.authId !== a.expectedAuthId ||
    ctx.user.activeWorkspaceId !== ctx.workspace._id
  )
    throw new ConvexError("NOTIFICATION_SCOPE_CHANGED");
  const sessionId = (await ctx.auth.getUserIdentity())?.sessionId;
  if (typeof sessionId !== "string" || !sessionId)
    throw new ConvexError("Unauthenticated");
  const p = await ctx.db
    .query("preferences")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", ctx.user._id).eq("workspaceId", ctx.workspace._id),
    )
    .unique();
  if (!p) throw new ConvexError("NOTIFICATION_PROFILE_UNAVAILABLE");
  const settings = p.notifications ?? {
    revision: 0,
    email: false,
    inAppSummaries: false,
    weekly: false,
    research: false,
    timezone: "UTC",
    quiet: null,
  };
  if (!Number.isSafeInteger(settings.revision) || settings.revision < 0)
    throw new ConvexError("NOTIFICATION_REVISION_INVALID");
  validateIntent(settings);
  return {
    p,
    sessionId,
    settings: { revision: settings.revision, ...intent(settings) },
  };
}
export const notifications = workspaceQuery({
  args: notificationArgs,
  returns: notificationResult,
  handler: async (ctx, a) => {
    const { sessionId, settings } = await ownNotificationRow(ctx, a);
    return {
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      requestKey: a.requestKey,
      settings,
    };
  },
});
export const saveNotifications = workspaceMutation({
  args: {
    ...notificationArgs,
    expectedRevision: v.number(),
    settings: notificationPreference,
  },
  returns: notificationResult,
  handler: async (ctx, a) => {
    if (!Number.isSafeInteger(a.expectedRevision) || a.expectedRevision < 0)
      throw new ConvexError("NOTIFICATION_REVISION_INVALID");
    const {
      p,
      sessionId,
      settings: current,
    } = await ownNotificationRow(ctx, a);
    validateIntent(a.settings);
    const desired = intent(a.settings);
    let settings = current;
    if (JSON.stringify(intent(current)) !== JSON.stringify(desired)) {
      if (a.expectedRevision !== current.revision)
        throw new ConvexError("NOTIFICATION_REVISION_CONFLICT");
      if (current.revision === Number.MAX_SAFE_INTEGER)
        throw new ConvexError("NOTIFICATION_REVISION_OVERFLOW");
      settings = { revision: current.revision + 1, ...desired };
      await ctx.db.patch(p._id, { notifications: settings });
    }
    return {
      authId: ctx.user.authId,
      sessionId,
      workspaceId: ctx.workspace._id,
      requestKey: a.requestKey,
      settings,
    };
  },
});
