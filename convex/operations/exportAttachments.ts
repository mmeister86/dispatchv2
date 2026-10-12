import { ConvexError, v, type Infer } from "convex/values";
import { workspaceQuery, requireWorkspace } from "../lib/authorization";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { components } from "../_generated/api";
import { ownedAttachmentThread } from "./exportPrivate";
import { role } from "../schema";
export const parent = v.union(
  v.object({
    kind: v.literal("conversation"),
    accountId: v.id("socialAccounts"),
    conversationId: v.id("conversations"),
  }),
  v.object({ kind: v.literal("research"), orderId: v.id("researchOrders") }),
);
export const correlation = {
  workspaceId: v.id("workspaces"),
  expectedAuthId: v.string(),
  expectedSessionId: v.string(),
  requestKey: v.string(),
  parent,
};
const attachment = v.union(
  v.object({ kind: v.literal("stored"), index: v.number() }),
  v.object({ kind: v.literal("inline"), index: v.number() }),
);
export const args = {
  ...correlation,
  messageId: v.string(),
  attachment,
  expectedChecksum: v.union(v.string(), v.null()),
};
export const receipt = {
  authId: v.string(),
  sessionId: v.string(),
  requestKey: v.string(),
  workspaceId: v.id("workspaces"),
  role,
  messageId: v.string(),
  attachment,
  checksum: v.string(),
  size: v.number(),
  name: v.string(),
  mime: v.string(),
  proofValidUntil: v.number(),
};
const MAX_BYTES = 8 * 1024 * 1024;
function denied(): never {
  throw new ConvexError("EXPORT_ATTACHMENT_UNAVAILABLE");
}
async function scope(
  ctx: QueryCtx,
  a: Infer<typeof parent>,
  c: {
    workspaceId: Infer<typeof correlation.workspaceId>;
    expectedAuthId: string;
    expectedSessionId: string;
    requestKey: string;
  },
) {
  const auth = await requireWorkspace(ctx, c.workspaceId);
  return ownedAttachmentThread({ ...ctx, ...auth }, { ...c, ...a });
}
function inlineBytes(value: ArrayBuffer | string): Uint8Array | null {
  if (value instanceof ArrayBuffer)
    return value.byteLength <= 65536 ? new Uint8Array(value) : denied();
  if (
    !value ||
    value.length > 87384 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    return null;
  try {
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 65536) return denied();
    return bytes;
  } catch {
    return null;
  }
}
function hex(value: string) {
  if (/^[a-f0-9]{64}$/i.test(value)) return value.toLowerCase();
  try {
    const decoded = atob(value);
    if (decoded.length !== 32) return denied();
    return Array.from(decoded, (c) =>
      c.charCodeAt(0).toString(16).padStart(2, "0"),
    ).join("");
  } catch {
    return denied();
  }
}
async function message(
  ctx: QueryCtx,
  a: Infer<typeof request>,
  proof: Awaited<ReturnType<typeof scope>>,
) {
  const [m] = await ctx.runQuery(components.agent.messages.getMessagesByIds, {
    messageIds: [a.messageId],
  });
  if (
    !m ||
    m._id !== a.messageId ||
    m.threadId !== proof.threadId ||
    (m.userId && m.userId !== proof.actorId) ||
    !m.message ||
    !["user", "assistant"].includes(m.message.role) ||
    (a.parent.kind === "research" && m.message.role !== "assistant")
  )
    denied();
  return m;
}
const request = v.object(args);
const descriptor = v.object({
  ...receipt,
  storageId: v.union(v.id("_storage"), v.null()),
  fileId: v.union(v.string(), v.null()),
  inline: v.union(v.bytes(), v.null()),
});
async function prove(
  ctx: QueryCtx,
  a: Infer<typeof request>,
): Promise<Infer<typeof descriptor>> {
  const proof = await scope(ctx, a.parent, a);
  const m = await message(ctx, a, proof);
  const index = a.attachment.index;
  if (!Number.isSafeInteger(index) || index < 0 || index > 1024)
    throw new ConvexError("EXPORT_REQUEST_INVALID");
  let storageId: Infer<typeof descriptor>["storageId"] = null,
    fileId: string | null = null,
    inline: ArrayBuffer | null = null;
  let size: number,
    checksum: string,
    name = "attachment",
    mime = "application/octet-stream";
  if (a.attachment.kind === "stored") {
    const id = m.fileIds?.[index];
    if (!id) denied();
    const file = await ctx.runQuery(components.agent.files.get, { fileId: id });
    if (!file) denied();
    storageId = ctx.db.system.normalizeId("_storage", file.storageId);
    if (!storageId) denied();
    const metadata = await ctx.db.system.get("_storage", storageId);
    if (
      !metadata ||
      metadata.sha256 !== file.hash ||
      !Number.isSafeInteger(metadata.size) ||
      metadata.size < 0
    )
      denied();
    size = metadata.size;
    if (size > MAX_BYTES) throw new ConvexError("EXPORT_ATTACHMENT_TOO_LARGE");
    checksum = hex(metadata.sha256);
    fileId = id;
    name = file.filename ?? name;
    const declared = file.mediaType ?? file.mimeType;
    if (metadata.contentType && declared && metadata.contentType !== declared)
      denied();
    mime = metadata.contentType ?? declared ?? mime;
  } else {
    const parts = m.message!.content;
    if (!Array.isArray(parts)) denied();
    const part = parts[index];
    if (!part || (part.type !== "file" && part.type !== "image")) denied();
    const bytes = inlineBytes(part.type === "file" ? part.data : part.image);
    if (!bytes)
      throw new ConvexError("EXPORT_ATTACHMENT_UNSUPPORTED_REFERENCE");
    inline = bytes.buffer as ArrayBuffer;
    size = bytes.byteLength;
    checksum = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", inline)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    name = part.type === "file" ? (part.filename ?? name) : "image";
    mime = part.mediaType ?? part.mimeType ?? mime;
  }
  if (a.expectedChecksum !== null && a.expectedChecksum !== checksum)
    throw new ConvexError("EXPORT_SCOPE_CHANGED");
  return {
    authId: proof.authId,
    sessionId: proof.sessionId,
    requestKey: proof.requestKey,
    workspaceId: proof.workspaceId,
    role: proof.role,
    proofValidUntil: proof.proofValidUntil,
    messageId: a.messageId,
    attachment: a.attachment,
    checksum,
    size,
    name,
    mime,
    storageId,
    fileId,
    inline,
  };
}
export const source = internalQuery({
  args,
  returns: descriptor,
  handler: prove,
});
const { workspaceId: _workspaceId, ...publicArgs } = args;
export const verify = workspaceQuery({
  args: publicArgs,
  returns: v.object(receipt),
  handler: async (ctx, a) => {
    const {
      storageId: _s,
      fileId: _f,
      inline: _i,
      ...safe
    } = await prove(ctx, { ...a, workspaceId: ctx.workspace._id });
    return safe;
  },
});
export const list = workspaceQuery({
  args: {
    expectedAuthId: v.string(),
    expectedSessionId: v.string(),
    requestKey: v.string(),
    parent,
    cursor: v.union(v.string(), v.null()),
  },
  returns: v.object({
    authId: v.string(),
    sessionId: v.string(),
    requestKey: v.string(),
    role,
    proofValidUntil: v.number(),
    workspaceId: v.id("workspaces"),
    cursor: v.string(),
    isDone: v.boolean(),
    rows: v.array(
      v.object({
        messageId: v.string(),
        stored: v.number(),
        inline: v.array(
          v.object({
            index: v.number(),
            disposition: v.union(
              v.literal("inline"),
              v.literal("stored-reference"),
              v.literal("unsupported-reference"),
            ),
          }),
        ),
      }),
    ),
  }),
  handler: async (ctx, a) => {
    if (a.cursor !== null && (!a.cursor || a.cursor.length > 16384))
      throw new ConvexError("EXPORT_REQUEST_INVALID");
    const proof = await scope(ctx, a.parent, {
      ...a,
      workspaceId: ctx.workspace._id,
    });
    const p = await ctx.runQuery(
      components.agent.messages.listMessagesByThreadId,
      {
        threadId: proof.threadId,
        order: "asc",
        paginationOpts: { cursor: a.cursor, numItems: 1 },
      },
    );
    const rows: {
      messageId: string;
      stored: number;
      inline: {
        index: number;
        disposition: "inline" | "stored-reference" | "unsupported-reference";
      }[];
    }[] = [];
    for (const m of p.page) {
      if (
        m.threadId !== proof.threadId ||
        (m.userId && m.userId !== proof.actorId)
      )
        denied();
      if (
        !m.message ||
        !["user", "assistant"].includes(m.message.role) ||
        (a.parent.kind === "research" && m.message.role !== "assistant")
      )
        continue;
      const stored = m.fileIds?.length ?? 0;
      if (stored > 25) throw new ConvexError("EXPORT_ATTACHMENT_TOO_LARGE");
      const aliases = new Set<string>();
      for (const fileId of m.fileIds ?? []) {
        const f = await ctx.runQuery(components.agent.files.get, { fileId });
        if (!f) denied();
        const id = ctx.db.system.normalizeId("_storage", f.storageId);
        if (!id) denied();
        const url = await ctx.storage.getUrl(id);
        if (url) aliases.add(url);
      }
      const inline: (typeof rows)[number]["inline"] = [];
      if (Array.isArray(m.message.content))
        m.message.content.forEach((part, index) => {
          if (part.type !== "file" && part.type !== "image") return;
          const value = part.type === "file" ? part.data : part.image;
          inline.push({
            index,
            disposition:
              typeof value === "string" && aliases.has(value)
                ? "stored-reference"
                : inlineBytes(value)
                  ? "inline"
                  : "unsupported-reference",
          });
        });
      if (stored || inline.length)
        rows.push({ messageId: m._id, stored, inline });
    }
    return {
      authId: proof.authId,
      sessionId: proof.sessionId,
      requestKey: proof.requestKey,
      role: proof.role,
      proofValidUntil: proof.proofValidUntil,
      workspaceId: ctx.workspace._id,
      cursor: p.continueCursor,
      isDone: p.isDone,
      rows,
    };
  },
});
