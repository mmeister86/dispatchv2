"use node";
import { ConvexError, v, type Infer } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { args, receipt } from "./exportAttachments";
const CHUNK = 512 * 1024;
const result = v.object({
  ...receipt,
  bytes: v.bytes(),
  offset: v.number(),
  nextOffset: v.number(),
  done: v.boolean(),
});
export const read = action({
  args: { ...args, offset: v.number() },
  returns: result,
  handler: async (ctx, { offset, ...a }): Promise<Infer<typeof result>> => {
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset % CHUNK !== 0 ||
      (offset > 0 && a.expectedChecksum === null)
    )
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const before = await ctx.runQuery(
      internal.operations.exportAttachments.source,
      a,
    );
    if (offset >= before.size && !(before.size === 0 && offset === 0))
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const blob = before.storageId
      ? await ctx.storage.get(before.storageId)
      : new Blob([before.inline!]);
    if (!blob || blob.size !== before.size)
      throw new ConvexError("EXPORT_ATTACHMENT_UNAVAILABLE");
    const end = Math.min(offset + CHUNK, before.size);
    const bytes = await blob.slice(offset, end).arrayBuffer();
    const after = await ctx.runQuery(
      internal.operations.exportAttachments.source,
      { ...a, expectedChecksum: before.checksum },
    );
    const stable = ({ proofValidUntil: _p, ...rest }: typeof before) => rest;
    if (
      Date.now() >= Math.min(before.proofValidUntil, after.proofValidUntil) ||
      JSON.stringify(stable(before)) !== JSON.stringify(stable(after))
    )
      throw new ConvexError("EXPORT_SCOPE_CHANGED");
    const { storageId: _s, fileId: _f, inline: _i, ...safe } = after;
    return {
      ...safe,
      bytes,
      offset,
      nextOffset: end,
      done: end === before.size,
    };
  },
});
