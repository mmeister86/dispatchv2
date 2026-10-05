import { ConvexError, v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal, components } from "./_generated/api";
import { checkApproval, checkAccountConnection, event } from "./editorial";
import { content } from "./lib/editorialFields";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
const job = { scheduleId: v.id("schedules"), generation: v.number() };
export async function preflight(ctx: QueryCtx, s: Doc<"schedules">) {
  const actor = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_workspaceId", (q) =>
      q.eq("userId", s.actorId).eq("workspaceId", s.workspaceId),
    )
    .unique();
  if (!actor || !["Owner", "Admin"].includes(actor.role))
    throw new ConvexError("SCHEDULER_AUTHORITY_CHANGED");
  await checkAccountConnection(ctx, s);
  const version = await checkApproval(
    ctx,
    s.workspaceId,
    s.versionId,
    s.accountId,
    s.approvalId,
    s,
  );
  const draft = await ctx.db.get(s.draftId);
  if (
    !draft ||
    draft.workspaceId !== s.workspaceId ||
    version.draftId !== s.draftId
  )
    throw new ConvexError("X_SCHEDULE_CHANGED");
  return version;
}
export async function failure(
  ctx: MutationCtx,
  s: Doc<"schedules">,
  code: string,
) {
  await ctx.db.patch(s._id, {
    state: s.publishedCount ? "partially_published" : "failed",
    errorCode: code,
  });
  await event(ctx, s.workspaceId, s.draftId, code, null, s._id);
  const id = await ctx.db.insert("publishingNotifications", {
    workspaceId: s.workspaceId,
    scheduleId: s._id,
    recipientId: s.actorId,
    state: "pending",
    errorCode: null,
    createdAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.publishing.notify, {
    notificationId: id,
  });
}
export const claim = internalMutation({
  args: job,
  returns: v.union(
    v.object({
      versionId: v.id("draftVersions"),
      accountId: v.id("socialAccounts"),
      content,
    }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.scheduleId);
    if (
      !s ||
      s.generation !== a.generation ||
      s.state !== "scheduled" ||
      s.abortRequestedAt !== undefined ||
      s.at > Date.now()
    )
      return null;
    try {
      const ver = await preflight(ctx, s);
      await ctx.db.patch(s._id, { state: "publishing" });
      await ctx.scheduler.runAfter(0, internal.publishing.workflows.step, a);
      await event(
        ctx,
        s.workspaceId,
        s.draftId,
        "PUBLISHING_CLAIMED",
        null,
        s._id,
      );
      return {
        versionId: ver._id,
        accountId: s.accountId,
        content: ver.content,
      };
    } catch (e) {
      await failure(
        ctx,
        s,
        e instanceof ConvexError ? String(e.data) : "PREFLIGHT_FAILED",
      );
      return null;
    }
  },
});
// The provider must call this before EVERY external send step; DB transactions do not cover external requests.
export const checkSend = internalMutation({
  args: job,
  returns: v.boolean(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.scheduleId);
    if (!s || s.generation !== a.generation || s.state !== "publishing")
      return false;
    try {
      await preflight(ctx, s);
      return true;
    } catch (e) {
      await failure(
        ctx,
        s,
        e instanceof ConvexError ? String(e.data) : "PREFLIGHT_FAILED",
      );
      return false;
    }
  },
});
export const unavailable = internalMutation({
  args: job,
  returns: v.null(),
  handler: async (ctx, a) => {
    const s = await ctx.db.get(a.scheduleId);
    if (s && s.generation === a.generation && s.state === "publishing")
      await failure(ctx, s, "PUBLISHER_NOT_CONFIGURED");
    return null;
  },
});
export const dispatch = internalAction({
  args: job,
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.runMutation(internal.publishing.claim, a);
    return null;
  },
});
export const recipient = internalQuery({
  args: { notificationId: v.id("publishingNotifications") },
  returns: v.union(
    v.object({ authId: v.string(), scheduleId: v.id("schedules") }),
    v.null(),
  ),
  handler: async (ctx, a) => {
    const n = await ctx.db.get(a.notificationId);
    if (!n || n.state !== "pending") return null;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_userId_and_workspaceId", (q) =>
        q.eq("userId", n.recipientId).eq("workspaceId", n.workspaceId),
      )
      .unique();
    const user = await ctx.db.get(n.recipientId);
    return user && membership
      ? { authId: user.authId, scheduleId: n.scheduleId }
      : null;
  },
});
export const notificationResult = internalMutation({
  args: {
    notificationId: v.id("publishingNotifications"),
    state: v.union(v.literal("sent"), v.literal("blocked")),
    errorCode: v.union(v.string(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    const n = await ctx.db.get(a.notificationId);
    if (n?.state === "pending")
      await ctx.db.patch(n._id, { state: a.state, errorCode: a.errorCode });
    return null;
  },
});
export const notify = internalAction({
  args: { notificationId: v.id("publishingNotifications") },
  returns: v.null(),
  handler: async (ctx, a) => {
    let errorCode: string | null = null;
    if (
      !process.env.AUTH_EMAIL_FROM ||
      !process.env.RESEND_API_KEY ||
      !process.env.SITE_URL
    )
      errorCode = "EMAIL_CONFIGURATION_REQUIRED";
    else {
      const recipient = await ctx.runQuery(internal.publishing.recipient, a);
      if (!recipient) errorCode = "RECIPIENT_UNAVAILABLE";
      else {
        const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
          model: "user",
          where: [{ field: "_id", value: recipient.authId }],
        });
        if (!user?.email) errorCode = "RECIPIENT_UNAVAILABLE";
        else
          try {
            const response = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                "Content-Type": "application/json",
                "Idempotency-Key": `publishing-${a.notificationId}`,
              },
              body: JSON.stringify({
                from: process.env.AUTH_EMAIL_FROM,
                to: [user.email],
                subject: "Dispatch: Veröffentlichung benötigt Aufmerksamkeit",
                text: `Ein geplanter Beitrag konnte nicht ausgeführt werden. Bitte Account und Publishing-Konfiguration im Kalender prüfen.\n\n${new URL("/calendar", process.env.SITE_URL).href}`,
              }),
            });
            if (!response.ok) errorCode = "EMAIL_DELIVERY_FAILED";
          } catch {
            errorCode = "EMAIL_DELIVERY_FAILED";
          }
      }
    }
    await ctx.runMutation(internal.publishing.notificationResult, {
      ...a,
      state: errorCode ? "blocked" : "sent",
      errorCode,
    });
    return null;
  },
});

export const version = internalQuery({
  args: { versionId: v.id("draftVersions") },
  returns: v.union(content, v.null()),
  handler: async (ctx, a) => (await ctx.db.get(a.versionId))?.content ?? null,
});
