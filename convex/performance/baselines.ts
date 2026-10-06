import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
const countSum = (values: number[]) => {
  const sum = values.reduce((s, n) => s + n, 0);
  return Number.isSafeInteger(sum) ? sum : null;
};
const nullable = v.union(v.number(), v.null());
const missing = v.array(v.object({ reason: v.string(), n: v.number() }));
export const baselineView = v.object({
  accountId: v.union(v.id("socialAccounts"), v.null()),
  version: v.literal("own-baseline-v1"),
  asOf: v.number(),
  toleranceMs: v.literal(60000),
  warningBelow: v.literal(10),
  coverage: v.object({
    partial: v.literal(true),
    nativeAttemptLimit: v.literal(20),
    nativeAttemptCount: v.number(),
    postsWithoutSnapshots: v.number(),
  }),
  followerGrowth: v.null(),
  cohorts: v.array(
    v.object({
      key: v.string(),
      windowHours: v.number(),
      unit: v.string(),
      media: v.string(),
      definitionVersion: v.union(v.string(), v.null()),
      dialect: v.union(v.string(), v.null()),
      n: v.number(),
      attempted: v.number(),
      ineligible: v.number(),
      small: v.boolean(),
      from: nullable,
      to: nullable,
      until: v.number(),
      metrics: v.array(
        v.object({
          name: v.string(),
          rawField: v.string(),
          definition: v.string(),
          n: v.number(),
          sum: nullable,
          mean: nullable,
          missing,
        }),
      ),
      rates: v.array(
        v.object({
          name: v.string(),
          components: v.array(v.string()),
          n: v.number(),
          numerator: nullable,
          denominator: nullable,
          value: nullable,
          missing,
        }),
      ),
      segments: v.array(
        v.object({
          dimension: v.union(v.literal("topic"), v.literal("publication-hour")),
          label: v.union(v.string(), v.null()),
          n: v.number(),
          attempted: v.number(),
          missing: v.number(),
          mean: nullable,
          reason: v.union(v.literal("unsafe-aggregate"), v.null()),
        }),
      ),
      chart: v.array(
        v.object({
          day: v.string(),
          n: v.number(),
          value: nullable,
          missing: v.number(),
        }),
      ),
      units: v.array(
        v.object({
          id: v.string(),
          externalIds: v.array(v.string()),
          snapshotIds: v.array(v.id("performanceSnapshots")),
          versionIds: v.array(v.string()),
          covered: v.number(),
          total: nullable,
          providerCreatedAt: nullable,
          observedAgeMs: nullable,
          observedAgesMs: v.array(
            v.object({ externalId: v.string(), ageMs: nullable }),
          ),
          topic: v.union(v.string(), v.null()),
          timezone: v.union(v.string(), v.null()),
          publicationHour: v.union(v.string(), v.null()),
          impressions: nullable,
          peerN: v.number(),
          baseline: nullable,
          ratio: nullable,
          reason: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
});
export type BaselinePost = {
  scheduleId: string;
  versionId: string;
  externalId: string;
  position: number;
  coverage: { confirmed: number; total: number | null };
  mediaType: string;
  topic: string | null;
  topicUntil: number;
  timezone: string | null;
  snapshots: Doc<"performanceSnapshots">[];
};
type Row = { post: BaselinePost; snapshot: Doc<"performanceSnapshots"> };
const reasons = (values: (string | null)[]) =>
  [...new Set(values.filter((x): x is string => x !== null))].map((reason) => ({
    reason,
    n: values.filter((x) => x === reason).length,
  }));
function ageReason(s: Doc<"performanceSnapshots">, asOf: number) {
  if (s.expiresAt <= asOf || s.state !== "observed") return "unavailable";
  if (s.providerCreatedAt === null || s.observedAt === null)
    return "missing-provider-time";
  if (
    Math.abs(s.observedAt - s.providerCreatedAt - s.windowHours * 3600000) >
    60000
  )
    return "outside-age-window";
  return null;
}
function hour(time: number | null, timezone: string | null) {
  if (time === null || !timezone) return null;
  try {
    return new Intl.DateTimeFormat("de-DE", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(time);
  } catch {
    return null;
  }
}
export function describe(
  posts: BaselinePost[],
  asOf = Date.now(),
  accountId: Doc<"socialAccounts">["_id"] | null = null,
) {
  const groups = new Map<string, Row[]>(),
    seen = new Set<string>();
  for (const post of posts)
    for (const snapshot of post.snapshots) {
      const duplicate = `${post.externalId}/${snapshot.windowHours}`;
      if (seen.has(duplicate)) continue;
      seen.add(duplicate);
      const key = JSON.stringify([
        accountId,
        post.coverage.total === 1 ? "post" : "thread",
        post.mediaType,
        snapshot.windowHours,
        snapshot.definitionVersion,
        snapshot.dialect,
        snapshot.fields.map((f) => [f.name, f.rawField, f.definition]).sort(),
      ]);
      groups.set(key, [...(groups.get(key) ?? []), { post, snapshot }]);
    }
  const cohorts = [...groups.entries()].map(([key, rows]) => {
    const first = rows[0],
      grouped = new Map<string, Row[]>();
    for (const r of rows)
      grouped.set(r.post.scheduleId, [
        ...(grouped.get(r.post.scheduleId) ?? []),
        r,
      ]);
    const units = [...grouped.entries()].map(([id, rs]) => {
      const p = rs[0].post,
        total = p.coverage.total;
      const complete =
        total !== null &&
        total === rs.length &&
        new Set(rs.map((r) => r.post.position)).size === total &&
        rs.every(
          (r) =>
            r.post.coverage.total === total &&
            r.post.coverage.confirmed === total &&
            r.post.versionId === p.versionId,
        ) &&
        [...Array(total).keys()].every((i) =>
          rs.some((r) => r.post.position === i),
        );
      const reason =
        p.mediaType === "unknown"
          ? "unknown-media-format"
          : !complete
            ? "incomplete-thread"
            : (rs
                .map((r) => ageReason(r.snapshot, asOf))
                .find((x) => x !== null) ?? null);
      const fields = first.snapshot.fields.map((f) => {
        const fs = rs.map((r) =>
          r.snapshot.fields.find(
            (x) =>
              x.name === f.name &&
              x.rawField === f.rawField &&
              x.definition === f.definition,
          ),
        );
        const missingReason =
          reason ??
          fs
            .map((x) =>
              !x
                ? "missing"
                : x.status !== "measured"
                  ? x.status
                  : x.value === null
                    ? "missing"
                    : !Number.isSafeInteger(x.value) || x.value < 0
                      ? "invalid"
                      : null,
            )
            .find((x) => x !== null) ??
          null;
        const value = missingReason
          ? null
          : fs.reduce((sum, x) => sum + x!.value!, 0);
        return {
          ...f,
          value: value !== null && Number.isSafeInteger(value) ? value : null,
          reason:
            missingReason ?? (Number.isSafeInteger(value) ? null : "invalid"),
        };
      });
      const positionZero = rs.find((r) => r.post.position === 0)?.snapshot;
      const created = positionZero?.providerCreatedAt ?? null;
      return {
        id,
        externalIds: rs.map((r) => r.post.externalId),
        snapshotIds: rs.map((r) => r.snapshot._id),
        versionIds: [...new Set(rs.map((r) => r.post.versionId))],
        covered: rs.length,
        total,
        providerCreatedAt: created,
        observedAgeMs:
          created !== null && positionZero?.observedAt != null
            ? positionZero.observedAt - created
            : null,
        observedAgesMs: rs.map((r) => ({
          externalId: r.post.externalId,
          ageMs:
            r.snapshot.observedAt !== null &&
            r.snapshot.providerCreatedAt !== null
              ? r.snapshot.observedAt - r.snapshot.providerCreatedAt
              : null,
        })),
        topic: p.topicUntil > asOf ? p.topic : null,
        timezone: p.timezone,
        publicationHour: hour(created, p.timezone),
        fields,
        reason,
        until: Math.min(
          ...rs.map((r) => r.snapshot.expiresAt),
          ...rs
            .filter((r) => r.post.topic !== null)
            .map((r) => r.post.topicUntil),
        ),
      };
    });
    const metrics = first.snapshot.fields.map((f) => {
      const fs = units.map((u) => u.fields.find((x) => x.name === f.name)!);
      const known = fs.filter((x) => x.value !== null);
      const sum = known.length ? countSum(known.map((x) => x.value!)) : null;
      return {
        name: f.name,
        rawField: f.rawField,
        definition: f.definition,
        n: known.length,
        sum,
        mean: sum === null ? null : sum / known.length,
        missing: [
          ...reasons(fs.map((x) => x.reason)),
          ...(known.length && sum === null
            ? [{ reason: "unsafe-aggregate", n: known.length }]
            : []),
        ],
      };
    });
    const rates = Object.entries({
      engagement: ["likes", "replies", "reposts", "quotes"],
      reply: ["replies"],
      repost: ["reposts"],
      click: ["url_clicks"],
    }).map(([name, components]) => {
      const matched = units.map((u) => {
        const denominator = u.fields.find((f) => f.name === "impressions"),
          nums = components.map((c) => u.fields.find((f) => f.name === c));
        let reason =
          u.reason ??
          denominator?.reason ??
          nums.find((f) => !f || f.reason)?.reason ??
          (!denominator || nums.some((f) => !f)
            ? "missing"
            : denominator.value === 0
              ? "zero-denominator"
              : null);
        const numerator = reason ? null : countSum(nums.map((f) => f!.value!));
        if (!reason && numerator === null) reason = "unsafe-numerator";
        return {
          reason,
          numerator,
          denominator: reason ? null : denominator!.value,
        };
      });
      const known = matched.filter((x) => x.reason === null);
      const numerator = known.length
          ? countSum(known.map((x) => x.numerator!))
          : null,
        denominator = known.length
          ? countSum(known.map((x) => x.denominator!))
          : null;
      return {
        name,
        components,
        n: known.length,
        numerator:
          numerator === null || denominator === null ? null : numerator,
        denominator:
          numerator === null || denominator === null ? null : denominator,
        value:
          denominator && numerator !== null ? numerator / denominator : null,
        missing: [
          ...reasons(matched.map((x) => x.reason)),
          ...(known.length && (numerator === null || denominator === null)
            ? [{ reason: "unsafe-aggregate", n: known.length }]
            : []),
        ],
      };
    });
    const segments = (["topic", "publication-hour"] as const).flatMap(
      (dimension) => {
        const label = (u: (typeof units)[number]) =>
          dimension === "topic"
            ? u.topic
            : u.publicationHour && u.timezone
              ? `${u.publicationHour} (${u.timezone})`
              : null;
        return [...new Set(units.map(label))].map((l) => {
          const members = units.filter((u) => label(u) === l),
            values = members
              .map((u) => u.fields.find((f) => f.name === "impressions")?.value)
              .filter((n): n is number => n !== null && n !== undefined),
            sum = countSum(values);
          return {
            dimension,
            label: l,
            n: values.length,
            attempted: members.length,
            missing: members.length - values.length,
            mean: values.length && sum !== null ? sum / values.length : null,
            reason:
              values.length && sum === null
                ? ("unsafe-aggregate" as const)
                : null,
          };
        });
      },
    );
    const dated = units.filter((u) => u.providerCreatedAt !== null),
      dates = dated.map((u) => u.providerCreatedAt!),
      from = dates.length ? Math.min(...dates) : null,
      to = dates.length ? Math.max(...dates) : null;
    const chart = [];
    // ponytail: at most 366 daily buckets; a wider historical chart needs explicit pagination.
    if (from !== null && to !== null)
      for (
        let t = Math.floor(from / 86400000) * 86400000;
        t <= to && chart.length < 366;
        t += 86400000
      ) {
        const day = new Date(t).toISOString().slice(0, 10),
          bucket = dated.filter(
            (u) =>
              new Date(u.providerCreatedAt!).toISOString().slice(0, 10) === day,
          ),
          known = bucket
            .map((u) => u.fields.find((f) => f.name === "impressions"))
            .filter((f) => f?.value !== null && f?.value !== undefined);
        chart.push({
          day,
          n: known.length,
          value: known.length ? countSum(known.map((f) => f!.value!)) : null,
          missing: bucket.length - known.length,
        });
      }
    return {
      key,
      windowHours: first.snapshot.windowHours,
      unit: first.post.coverage.total === 1 ? "post" : "thread",
      media: first.post.mediaType,
      definitionVersion: first.snapshot.definitionVersion,
      dialect: first.snapshot.dialect,
      n: metrics.find((m) => m.name === "impressions")?.n ?? 0,
      attempted: units.length,
      ineligible:
        units.length - (metrics.find((m) => m.name === "impressions")?.n ?? 0),
      small: (metrics.find((m) => m.name === "impressions")?.n ?? 0) < 10,
      from,
      to,
      until: Math.min(...units.map((u) => u.until)),
      metrics,
      rates,
      segments,
      chart,
      units: units.map(({ fields, until, ...u }) => {
        const value =
            fields.find((f) => f.name === "impressions")?.value ?? null,
          peers = units
            .filter((x) => x.id !== u.id)
            .map((x) => x.fields.find((f) => f.name === "impressions")?.value)
            .filter((x): x is number => x !== null && x !== undefined),
          peerSum = countSum(peers),
          baseline =
            peers.length && peerSum !== null ? peerSum / peers.length : null;
        return {
          ...u,
          impressions: value,
          peerN: peers.length,
          baseline,
          ratio: baseline && value !== null ? value / baseline : null,
        };
      }),
    };
  });
  return {
    accountId,
    version: "own-baseline-v1" as const,
    asOf,
    toleranceMs: 60000 as const,
    warningBelow: 10 as const,
    coverage: {
      partial: true as const,
      nativeAttemptLimit: 20 as const,
      nativeAttemptCount: posts.length,
      postsWithoutSnapshots: posts.filter((p) => !p.snapshots.length).length,
    },
    cohorts,
    followerGrowth: null,
  };
}
