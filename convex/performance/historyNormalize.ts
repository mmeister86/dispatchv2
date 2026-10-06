import type { Infer } from "convex/values";
import { importedPost } from "./historyFields";
// Latest provider edits are imported context, never original publication text.
export function normalizePage(
  data: unknown,
  owner: string,
  maxResults: number,
) {
  const result: {
    resourceCount: number | null;
    posts: Infer<typeof importedPost>[];
    rejected: number;
    nextCursor: string | null;
    reason: string | null;
  } = {
    resourceCount: null,
    posts: [],
    rejected: 0,
    nextCursor: null,
    reason: "OWN_HISTORY_RESPONSE_INVALID",
  };
  if (!data || typeof data !== "object" || Array.isArray(data)) return result;
  const body = data as Record<string, unknown>,
    meta = body.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return result;
  const m = meta as Record<string, unknown>,
    rows = body.data ?? (m.result_count === 0 ? [] : null);
  if (
    !Array.isArray(rows) ||
    rows.length > maxResults ||
    m.result_count !== rows.length ||
    body.errors !== undefined ||
    (m.next_token !== undefined &&
      (typeof m.next_token !== "string" ||
        !/^[A-Za-z0-9_-]{1,1024}$/.test(m.next_token)))
  )
    return result;
  const ids = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) return result;
    const r = row as Record<string, unknown>;
    if (
      typeof r.id !== "string" ||
      !/^[0-9]{1,19}$/.test(r.id) ||
      r.author_id !== owner ||
      ids.has(r.id)
    )
      return result;
    ids.add(r.id);
  }
  result.resourceCount = rows.length;
  result.nextCursor = (m.next_token as string | undefined) ?? null;
  result.reason = null;
  let payloadBytes = 0;
  for (const row of rows) {
    const r = row as Record<string, unknown>,
      date =
        typeof r.created_at === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
          r.created_at,
        )
          ? Date.parse(r.created_at)
          : NaN;
    const refs = r.referenced_tweets ?? [];
    if (
      !Array.isArray(refs) ||
      refs.some(
        (ref) =>
          !ref ||
          typeof ref !== "object" ||
          typeof ref.id !== "string" ||
          !/^[0-9]{1,19}$/.test(ref.id) ||
          !["replied_to", "quoted", "retweeted"].includes(ref.type),
      ) ||
      refs.some((ref) => ref.type === "retweeted") ||
      typeof r.text !== "string" ||
      !r.text.trim() ||
      r.text.length > 25000 ||
      !Number.isFinite(date) ||
      date > Date.now()
    ) {
      result.rejected++;
      continue;
    }
    const replies = refs.filter((ref) => ref.type === "replied_to");
    if (replies.length > 1) {
      result.rejected++;
      continue;
    }
    const post = {
      externalId: r.id as string,
      text: r.text,
      providerCreatedAt: date,
      contentType: replies.length ? ("reply" as const) : ("original" as const),
      mediaType:
        r.attachments === undefined ? ("none" as const) : ("unknown" as const),
      replyTo: replies[0]?.id ?? null,
    };
    const bytes = new TextEncoder().encode(JSON.stringify(post)).byteLength;
    // Keep each mutation/query payload below the native 8 MiB limit; oversized context is visibly partial.
    if (payloadBytes + bytes > 6 * 1024 * 1024) {
      result.rejected++;
      continue;
    }
    payloadBytes += bytes;
    result.posts.push(post);
  }
  return result;
}
