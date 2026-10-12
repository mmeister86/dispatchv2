import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import agent from "@convex-dev/agent/test";
import workflow from "@convex-dev/workflow/test";
import agentDistSchema from "../../node_modules/@convex-dev/agent/dist/component/schema.js";
import workflowDistSchema from "../../node_modules/@convex-dev/workflow/dist/component/schema.js";
const agentDistModules = import.meta.glob(
  "../../node_modules/@convex-dev/agent/dist/component/**/*.js",
);
const workflowDistModules = import.meta.glob(
  "../../node_modules/@convex-dev/workflow/dist/component/**/*.js",
);
const ref = (name: string) => makeFunctionReference<"mutation">(name);
const list = makeFunctionReference<"query">("erasure:listForThread");
afterEach(() => vi.useRealTimers());

test.each(["source", "dist"])(
  "%s Agent captures exact files before root loss, preserves shared positive aliases, and drains all10 thread vector families",
  async (mode) => {
    vi.useFakeTimers();
    const t = convexTest(
      mode === "source" ? agent.schema : agentDistSchema,
      mode === "source" ? agent.modules : agentDistModules,
    );
    const f = await t.run(async (ctx) => {
      const threadId = await ctx.db.insert("threads", {
        userId: "owned",
        status: "active",
      });
      const foreign = await ctx.db.insert("threads", {
        userId: "foreign",
        status: "active",
      });
      const fileId = await ctx.db.insert("files", {
        storageId: "synthetic-storage",
        hash: "hash",
        refcount: 1,
        lastTouchedAt: 0,
      });
      const alias = await ctx.db.insert("files", {
        storageId: "synthetic-storage",
        hash: "hash",
        refcount: 1,
        lastTouchedAt: 0,
        filename: "foreign",
      });
      await ctx.db.insert("messages", {
        threadId,
        userId: "owned",
        order: 0,
        stepOrder: 0,
        tool: false,
        status: "success",
        fileIds: [fileId],
        text: "private",
      });
      await ctx.db.insert("memories", {
        threadId,
        userId: "owned",
        memory: "private",
      });
      await ctx.db.insert("memories", {
        threadId: foreign,
        userId: "foreign",
        memory: "foreign",
      });
      for (const n of [
        128, 256, 512, 768, 1024, 1408, 1536, 2048, 3072, 4096,
      ] as const) {
        await ctx.db.insert(`embeddings_${n}`, {
          model: "m",
          table: "memories",
          threadId,
          userId: "owned",
          vector: Array(n).fill(0),
        });
        await ctx.db.insert(`embeddings_${n}`, {
          model: "m",
          table: "memories",
          threadId: foreign,
          userId: "foreign",
          vector: Array(n).fill(0),
        });
      }
      return { threadId, foreign, fileId, alias };
    });
    const scope = { threadId: f.threadId, expectedUserId: "owned" };
    await expect(
      t.query(list, {
        ...scope,
        expectedUserId: "foreign",
        paginationOpts: { cursor: null, numItems: 25 },
      }),
    ).rejects.toThrow("ERASURE_OWNER_CHANGED");
    await t.mutation(ref("threads:deleteAllForThreadIdAsync"), {
      threadId: f.threadId,
      limit: 25,
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const claims = await t.query(list, {
      ...scope,
      paginationOpts: { cursor: null, numItems: 25 },
    });
    expect(claims.page).toEqual([
      {
        fileId: f.fileId,
        storageId: "synthetic-storage",
        refcount: 0,
        hash: "hash",
      },
    ]);
    const deleted = await t.mutation(ref("erasure:deleteUnusedClaimed"), {
      ...scope,
      claims: claims.page.map(
        ({ fileId, storageId }: { fileId: string; storageId: string }) => ({
          fileId,
          storageId,
        }),
      ),
    });
    expect(deleted).toEqual({
      deletedStorageIds: [],
      sharedFileIds: [f.fileId],
    });
    expect(await t.run((ctx) => ctx.db.get(f.alias))).toMatchObject({
      refcount: 1,
    });
    let phase = 0;
    for (let i = 0; i < 12; i++) {
      const r = await t.mutation(ref("erasure:deleteThreadResiduals"), {
        ...scope,
        phase,
      });
      phase = r.nextPhase;
      if (r.isDone) break;
    }
    expect(
      await t.run((ctx) => ctx.db.query("memories").collect()),
    ).toHaveLength(1);
    for (const n of [
      128, 256, 512, 768, 1024, 1408, 1536, 2048, 3072, 4096,
    ] as const)
      expect(
        await t.run((ctx) => ctx.db.query(`embeddings_${n}`).collect()),
      ).toHaveLength(1);
  },
);

test.each(["source", "dist"])(
  "%s Agent scopes rootless user memories and all vector tables with bounded residual pages",
  async (mode) => {
    const t = convexTest(
      mode === "source" ? agent.schema : agentDistSchema,
      mode === "source" ? agent.modules : agentDistModules,
    );
    const f = await t.run(async (ctx) => {
      for (let i = 0; i < 26; i++)
        await ctx.db.insert("memories", { userId: "owned", memory: "private" });
      await ctx.db.insert("memories", { userId: "foreign", memory: "foreign" });
      for (const n of [
        128, 256, 512, 768, 1024, 1408, 1536, 2048, 3072, 4096,
      ] as const) {
        for (const userId of ["owned", "foreign"])
          await ctx.db.insert(`embeddings_${n}`, {
            model: "m",
            table: "memories",
            userId,
            vector: Array(n).fill(0),
          });
      }
      return await ctx.db.insert("threads", {
        userId: "owned",
        status: "active",
      });
    });
    expect(
      await t.mutation(ref("erasure:deleteUserMemories"), {
        userId: "owned",
        phase: 0,
      }),
    ).toEqual({ isDone: false, nextPhase: 0 });
    expect(
      await t.run((ctx) => ctx.db.query("memories").collect()),
    ).toHaveLength(2);
    await t.mutation(ref("erasure:deleteUserMemories"), {
      userId: "owned",
      phase: 0,
    });
    expect(
      await t.run((ctx) => ctx.db.query("memories").collect()),
    ).toHaveLength(1);
    for (let phase = 1; phase <= 10; phase++)
      await t.mutation(ref("erasure:deleteUserMemories"), {
        userId: "owned",
        phase,
      });
    for (const n of [
      128, 256, 512, 768, 1024, 1408, 1536, 2048, 3072, 4096,
    ] as const)
      expect(
        await t.run((ctx) => ctx.db.query(`embeddings_${n}`).collect()),
      ).toMatchObject([{ userId: "foreign" }]);
    await expect(
      t.mutation(ref("erasure:deleteThreadResiduals"), {
        threadId: f,
        expectedUserId: "foreign",
        phase: 0,
      }),
    ).rejects.toThrow("ERASURE_OWNER_CHANGED");
  },
);

test.each(["source", "dist"])(
  "%s Workflow deletes only exact completed workflow residual events/failures, bounded and restartable after parent loss",
  async (mode) => {
    const t = convexTest(
      mode === "source" ? workflow.schema : workflowDistSchema,
      mode === "source" ? workflow.modules : workflowDistModules,
    );
    const f = await t.run(async (ctx) => {
      const own = await ctx.db.insert("workflows", {
        workflowHandle: "h",
        args: {},
        generationNumber: 1,
        runResult: { kind: "success", returnValue: null },
      });
      const foreign = await ctx.db.insert("workflows", {
        workflowHandle: "h",
        args: {},
        generationNumber: 1,
      });
      for (let i = 0; i < 26; i++) {
        await ctx.db.insert("events", {
          workflowId: own,
          name: "e",
          state: {
            kind: "sent",
            sentAt: 0,
            result: { kind: "success", returnValue: "private" },
          },
        });
        await ctx.db.insert("onCompleteFailures", {
          workflowId: own,
          generationNumber: 1,
          runResult: { kind: "success", returnValue: "private" },
          error: "private",
        });
      }
      await ctx.db.insert("events", {
        workflowId: foreign,
        name: "foreign",
        state: { kind: "created" },
      });
      return { own, foreign };
    });
    await expect(
      t.mutation(ref("erasure:deleteResiduals"), { workflowId: f.foreign }),
    ).rejects.toThrow("ERASURE_WORKFLOW_ACTIVE");
    const status = makeFunctionReference<"query">("erasure:scopeStatus");
    expect(await t.query(status, { workflowId: f.own })).toBe("complete");
    expect(await t.query(status, { workflowId: f.foreign })).toBe("active");
    expect(
      await t.mutation(ref("erasure:deleteResiduals"), { workflowId: f.own }),
    ).toEqual({ isDone: false });
    await t.run((ctx) => ctx.db.delete(f.own));
    expect(await t.query(status, { workflowId: f.own })).toBe("missing");
    expect(
      await t.mutation(ref("erasure:deleteResiduals"), { workflowId: f.own }),
    ).toEqual({ isDone: true });
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toHaveLength(
      1,
    );
    expect(
      await t.run((ctx) => ctx.db.query("onCompleteFailures").collect()),
    ).toHaveLength(0);
  },
);

test.each(["source", "dist"])(
  "%s Agent returns only unshared claimed storage and rejects owner/storage mismatches",
  async (mode) => {
    const t = convexTest(
      mode === "source" ? agent.schema : agentDistSchema,
      mode === "source" ? agent.modules : agentDistModules,
    );
    const f = await t.run(async (ctx) => {
      const threadId = await ctx.db.insert("threads", {
        userId: "owned",
        status: "active",
      });
      const fileId = await ctx.db.insert("files", {
        storageId: "unshared",
        hash: "hash",
        refcount: 0,
        lastTouchedAt: 0,
      });
      await ctx.db.insert("fileCleanupClaims", {
        threadId,
        userId: "owned",
        fileId,
        storageId: "unshared",
        hash: "hash",
      });
      await ctx.db.delete(threadId);
      return { threadId, fileId };
    });
    const args = {
      threadId: f.threadId,
      expectedUserId: "owned",
      claims: [{ fileId: f.fileId, storageId: "unshared" }],
    };
    await expect(
      t.mutation(ref("erasure:deleteUnusedClaimed"), {
        ...args,
        expectedUserId: "foreign",
      }),
    ).rejects.toThrow("ERASURE_FILE_UNCLAIMED");
    await expect(
      t.mutation(ref("erasure:deleteUnusedClaimed"), {
        ...args,
        claims: [{ fileId: f.fileId, storageId: "wrong" }],
      }),
    ).rejects.toThrow("ERASURE_FILE_UNCLAIMED");
    expect(await t.run((ctx) => ctx.db.get(f.fileId))).not.toBeNull();
    expect(await t.mutation(ref("erasure:deleteUnusedClaimed"), args)).toEqual({
      deletedStorageIds: ["unshared"],
      sharedFileIds: [],
    });
    expect(await t.run((ctx) => ctx.db.get(f.fileId))).toBeNull();
    expect(
      await t.run((ctx) => ctx.db.query("fileCleanupClaims").collect()),
    ).toEqual([]);
    await expect(
      t.mutation(ref("erasure:deleteUnusedClaimed"), args),
    ).rejects.toThrow("ERASURE_FILE_UNCLAIMED");
  },
);

test.each(["source", "dist"])(
  "%s Agent age-filtered user cleanup preserves younger context and foreign ownership",
  async (mode) => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const t = convexTest(
      mode === "source" ? agent.schema : agentDistSchema,
      mode === "source" ? agent.modules : agentDistModules,
    );
    await t.run(async (ctx) => {
      for (const userId of ["owned", "foreign"]) {
        await ctx.db.insert("memories", { userId, memory: "old" });
        for (const n of [
          128, 256, 512, 768, 1024, 1408, 1536, 2048, 3072, 4096,
        ] as const)
          await ctx.db.insert(`embeddings_${n}`, {
            userId,
            model: "m",
            table: "memories",
            vector: Array(n).fill(0),
          });
      }
    });
    vi.setSystemTime(2000);
    await t.run((ctx) =>
      ctx.db.insert("memories", { userId: "owned", memory: "young" }),
    );
    for (let phase = 0; phase <= 10; phase++)
      await t.mutation(ref("erasure:deleteUserMemories"), {
        userId: "owned",
        phase,
        olderThan: 1500,
      });
    expect(
      await t.run((ctx) => ctx.db.query("memories").collect()),
    ).toMatchObject([
      { userId: "foreign", memory: "old" },
      { userId: "owned", memory: "young" },
    ]);
    for (const n of [
      128, 256, 512, 768, 1024, 1408, 1536, 2048, 3072, 4096,
    ] as const)
      expect(
        await t.run((ctx) => ctx.db.query(`embeddings_${n}`).collect()),
      ).toMatchObject([{ userId: "foreign" }]);
  },
);
