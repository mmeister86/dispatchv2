import {
  WorkflowManager,
  vWorkflowId,
  vResultValidator,
} from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: { maxParallelism: 4, retryActionsByDefault: false },
});
export const research = workflow
  .define({
    args: { orderId: v.id("researchOrders"), generation: v.number() },
    returns: v.null(),
  })
  .handler(async (step, args): Promise<null> => {
    const operations = await step.runMutation(
      internal.ai.researchTools.reserve,
      args,
    );
    await step.runMutation(internal.ai.researchTools.prepare, args);
    for (const operation of operations)
      await step.runAction(
        internal.research.execute.operation,
        { ...args, operation },
        { retry: false },
      );
    await step.runMutation(internal.ai.researchTools.select, args);
    const runId = await step.runMutation(
      internal.ai.researchTools.bindModel,
      args,
    );
    if (runId)
      await step.runAction(
        internal.ai.provider.execute,
        { runId },
        { retry: false },
      );
    await step.runMutation(internal.ai.researchTools.cluster, args);
    await step.runMutation(internal.ai.researchTools.assess, args);
    await step.runMutation(internal.ai.researchTools.evidence, args);
    await step.runMutation(internal.ai.researchTools.inbox, args);
    await step.runMutation(internal.ai.researchTools.finish, args);
    return null;
  });
export const completed = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({
      orderId: v.id("researchOrders"),
      generation: v.number(),
    }),
  },
  returns: v.null(),
  handler: async (ctx, a) => {
    if (a.result.kind !== "success")
      await ctx.runMutation(internal.ai.researchTools.fail, {
        ...a.context,
        cancelled: a.result.kind === "canceled",
      });
    return null;
  },
});
