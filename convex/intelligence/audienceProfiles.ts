import { begin, finish, replay, text } from "./profiles";
import { v } from "convex/values";
import { workspaceMutation } from "../lib/authorization";
import { commandArgs, result } from "./sharedFields";
export const create = workspaceMutation({
  args: { ...commandArgs, description: v.string() },
  returns: result,
  handler: async (ctx, a) => {
    const b = await begin(ctx, a, { kind: "create-audience", ...a });
    if (b.receipt) return replay(b.receipt);
    text(a.description, 4000);
    const audienceId = await ctx.db.insert("audienceProfiles", {
      workspaceId: ctx.workspace._id,
      accountId: a.accountId,
      network: "x",
      surface: "for_you",
      createdBy: ctx.user._id,
      createdAt: Date.now(),
      status: "draft",
      review: null,
      retiredAt: null,
      payload: {
        version: "declared-audience-v1",
        description: a.description,
        source: "authorized_declaration",
        measurement: "unavailable",
        embedding: "unavailable",
      },
    });
    return finish(ctx, a, b, "create-audience", "Declared account context", {
      algorithmId: null,
      audienceId,
    });
  },
});
