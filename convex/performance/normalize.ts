import type { Infer } from "convex/values";
import { field } from "./fields";
export const definitions = {
  impressions: "Repeated impressions; not unique audience",
  likes: "Public like count",
  replies: "Public reply count",
  reposts: "Public repost count; dialect configured",
  quotes: "Public quote count; excludes reposts",
  bookmarks: "Public bookmark count",
  url_clicks: "Own eligible post URL clicks",
  profile_clicks: "Own eligible post profile clicks",
};
export function normalize(
  data: unknown,
  id: string,
  providerIdentity: string,
  names: string[],
  dialect: "tweet-fields-retweet-v2" | "post-fields-repost-v2",
  fallback?: "unavailable" | "deleted" | "access_expired",
): {
  fields: Infer<typeof field>[];
  providerCreatedAt: number | null;
  valid: boolean;
} {
  const row =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { data?: Record<string, unknown> }).data
      : undefined;
  const valid = !!row && row.id === id && row.author_id === providerIdentity;
  const publicFields: Record<string, string> = {
    impressions: "impression_count",
    likes: "like_count",
    replies: "reply_count",
    reposts:
      dialect === "tweet-fields-retweet-v2" ? "retweet_count" : "repost_count",
    quotes: "quote_count",
    bookmarks: "bookmark_count",
  };
  const fields = names.map((name) => {
    const group = publicFields[name] ? "public_metrics" : "non_public_metrics",
      rawField =
        publicFields[name] ??
        (
          {
            impressions: "impression_count",
            url_clicks: "url_link_clicks",
            profile_clicks: "user_profile_clicks",
          } as Record<string, string>
        )[name];
    const object = valid ? row![group] : undefined,
      value =
        object && typeof object === "object" && !Array.isArray(object)
          ? (object as Record<string, unknown>)[rawField]
          : undefined;
    const invalidGroup =
      object !== undefined &&
      (object === null || typeof object !== "object" || Array.isArray(object));
    const measured =
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
    return {
      name,
      rawField: `${group}.${rawField}`,
      definition: definitions[name as keyof typeof definitions],
      status:
        fallback ??
        (!valid || invalidGroup
          ? "invalid"
          : value === undefined
            ? "missing"
            : measured
              ? "measured"
              : "invalid"),
      value: !fallback && measured ? (value as number) : null,
    } as Infer<typeof field>;
  });
  const parsed =
    valid &&
    typeof row!.created_at === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      row!.created_at,
    )
      ? Date.parse(row!.created_at)
      : NaN;
  return {
    fields,
    providerCreatedAt:
      Number.isFinite(parsed) && parsed <= Date.now() ? parsed : null,
    valid,
  };
}
