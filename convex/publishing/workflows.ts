"use node";
import { v, ConvexError } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { job } from "./postFields";
import { postRequest, PostRequestError } from "../integrations/x/publish";
// Native scheduler steps never retry a non-idempotent POST. Only preparing work may resume.
export const step = internalAction({
  args: job,
  returns: v.null(),
  handler: async (ctx, a): Promise<null> => {
    const c = await ctx.runMutation(internal.publishing.attempts.claim, a);
    if (!c) return null;
    const claim = { attemptId: c._id, claimSequence: c.claimSequence };
    let sending = false;
    const started = Date.now();
    try {
      const mediaIds = await ctx.runMutation(
        internal.publishing.attempts.readiness,
        claim,
      );
      if (mediaIds === null) return null;
      const credential = await ctx.runAction(
        internal.integrations.x.client.credentialForSchedule,
        { ...a, operation: "text" },
      );
      const version = await ctx.runQuery(internal.publishing.version, {
        versionId: c.versionId,
      });
      if (!version) throw new ConvexError("X_SCHEDULE_CHANGED");
      const ok = await ctx.runMutation(
        internal.publishing.attempts.beforeSend,
        {
          ...claim,
          credentialGeneration: credential.credentialGeneration,
          mediaIds,
        },
      );
      if (!ok) return null;
      sending = true;
      const result = await postRequest(
        credential.accessToken,
        version.text[c.position],
        mediaIds,
        c.parentId,
      );
      // Immediately checkpoint the returned ID; no intervening query, logging or next send.
      await ctx.runMutation(internal.publishing.attempts.receipt, {
        ...claim,
        outcome: "confirmed",
        externalId: result.externalId,
        httpStatus: 201,
        ...(result.rateResetAt ? { rateResetAt: result.rateResetAt } : {}),
        durationMs: Date.now() - started,
      });
    } catch (e) {
      await ctx.runMutation(internal.publishing.attempts.receipt, {
        ...claim,
        outcome: sending
          ? e instanceof PostRequestError
            ? e.outcome
            : "unknown"
          : "rejected",
        errorCode:
          e instanceof ConvexError
            ? String(e.data)
            : e instanceof PostRequestError
              ? e.code
              : sending
                ? "X_POST_OUTCOME_UNKNOWN"
                : "X_PUBLISH_PREPARATION_FAILED",
        ...(e instanceof PostRequestError && e.httpStatus
          ? { httpStatus: e.httpStatus }
          : {}),
        ...(e instanceof PostRequestError && e.rateResetAt
          ? { rateResetAt: e.rateResetAt }
          : {}),
        durationMs: Date.now() - started,
      });
    }
    return null;
  },
});
