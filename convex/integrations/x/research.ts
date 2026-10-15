import type { Doc } from "../../_generated/dataModel";
import {
  boundedResponse,
  readBytes,
  emptyResult,
  SearchError,
} from "../../research/transport";
export async function searchX(
  o: Doc<"researchOrders">,
  p: Doc<"researchSourcePolicies">,
  key: string,
) {
  const result = emptyResult(),
    recent = p.operation === "x-recent",
    url = new URL(
      recent
        ? "https://api.x.com/2/tweets/search/recent"
        : `https://api.x.com/2/trends/by/woeid/${p.woeid}`,
    );
  if (recent) {
    const query = `(${o.native!.query}) lang:${o.native!.language.split("-")[0]} -is:retweet`;
    if (query.length > 512) throw new SearchError("RESEARCH_QUERY_LIMIT");
    url.searchParams.set("query", query);
    url.searchParams.set("max_results", "10");
    url.searchParams.set("post.fields", "created_at,withheld,public_metrics");
    url.searchParams.set(
      "start_time",
      new Date(
        Math.max(o.windowStart, o.windowEnd - 7 * 86400000 + 1000),
      ).toISOString(),
    );
    url.searchParams.set("end_time", new Date(o.windowEnd).toISOString());
  } else {
    url.searchParams.set("max_trends", "10");
    url.searchParams.set("trend.fields", "trend_name,tweet_count");
  }
  const { response, close } = await boundedResponse(
    url.href,
    { method: "GET", headers: { Authorization: `Bearer ${key}` } },
    o.deadline,
  );
  try {
    if (!response.ok) {
      result.reason =
        response.status === 429
          ? "RESEARCH_RATE_LIMITED"
          : "RESEARCH_PROVIDER_UNAVAILABLE";
      return result;
    }
    const body: unknown = JSON.parse(await readBytes(response, 65536));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new SearchError("RESEARCH_RESPONSE_INVALID");
    const b = body as {
      data?: unknown;
      errors?: unknown;
      meta?: { next_token?: unknown; result_count?: unknown };
    };
    if (b.data === undefined && b.meta?.result_count === 0) b.data = [];
    if (!Array.isArray(b.data) || b.data.length > 10)
      throw new SearchError("RESEARCH_RESPONSE_INVALID");
    for (const value of b.data) {
      if (!value || typeof value !== "object")
        throw new SearchError("RESEARCH_SOURCE_INVALID");
      if (recent) {
        const r = value as {
          id?: unknown;
          text?: unknown;
          created_at?: unknown;
          withheld?: unknown;
          protected?: unknown;
          public_metrics?: {
            like_count?: unknown;
            repost_count?: unknown;
            reply_count?: unknown;
            quote_count?: unknown;
          };
        };
        if (
          typeof r.id !== "string" ||
          !/^\d{1,19}$/.test(r.id) ||
          typeof r.text !== "string" ||
          r.text.length > 2000 ||
          typeof r.created_at !== "string" ||
          !Number.isFinite(Date.parse(r.created_at))
        )
          throw new SearchError("RESEARCH_SOURCE_INVALID");
        if (r.withheld || r.protected === true) continue;
        const at = Date.parse(r.created_at);
        if (
          at < Math.max(o.windowStart, o.windowEnd - 7 * 86400000 + 1000) ||
          at > o.windowEnd
        )
          throw new SearchError("RESEARCH_SOURCE_WINDOW_INVALID");
        const metrics = r.public_metrics,
          values = metrics
            ? [
                metrics.like_count,
                metrics.repost_count,
                metrics.reply_count,
                metrics.quote_count,
              ]
            : [];
        const count =
          values.length === 4 &&
          values.every(
            (n) =>
              typeof n === "number" &&
              Number.isSafeInteger(n) &&
              n >= 0 &&
              n <= 1e12,
          )
            ? values.reduce<number>((sum, n) => sum + Number(n), 0)
            : null;
        result.sources.push({
          providerIdentity: r.id,
          url: `https://x.com/i/web/status/${r.id}`,
          title: `X Post ${r.id}`,
          text: r.text,
          publishedAt: at,
          count,
        });
      } else {
        const r = value as { trend_name?: unknown; tweet_count?: unknown };
        if (
          typeof r.trend_name !== "string" ||
          !r.trend_name.trim() ||
          r.trend_name.length > 500
        )
          throw new SearchError("RESEARCH_SOURCE_INVALID");
        const count =
          typeof r.tweet_count === "number" &&
          Number.isSafeInteger(r.tweet_count) &&
          r.tweet_count >= 0
            ? r.tweet_count
            : null;
        result.sources.push({
          providerIdentity: `${p.woeid}:${r.trend_name}`,
          url: null,
          title: r.trend_name,
          text: null,
          publishedAt: null,
          count,
        });
      }
    }
    // Validate delivered public items before retaining partial output; mixed errors leave cost uncertain.
    if (b.errors) throw new SearchError("RESEARCH_RESPONSE_INVALID");
    result.units = recent ? b.data.length : 1;
    result.truncated = !!b.meta?.next_token;
    result.state = result.sources.length ? "completed" : "empty";
    result.reason = null;
    return result;
  } catch (e) {
    result.state = result.sources.length ? "partial" : "unknown";
    result.reason =
      e instanceof SearchError ? e.code : "RESEARCH_RESPONSE_INVALID";
    result.units = null;
    return result;
  } finally {
    close();
  }
}
